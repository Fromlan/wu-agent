/**
 * The Markdown vault behind the knowledge workbench.
 *
 * Layout (all inside one configurable vault directory):
 *   inbox/          candidate cards awaiting a human decision
 *   library/        confirmed notes (the permanent knowledge base)
 *   briefs/         one research brief per day
 *   .workbench/     machine state, trash, and atomic-write scratch files
 *   偏好.md / 待研究.md  human-facing mirrors of preferences and questions
 *
 * Every operation is local to the vault; no network call and no model call is
 * made here. Writes are serialized and committed with a same-directory rename.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  REVIEW, decodeNoteId, encodeNoteId, excerptOf, isCardId, localDate, newCardId,
  normalizeTags, parseNote, renderCard, renderFrontmatter, sectionLine,
} from './note.js';
import { BASE_FILE, CONFIRM_REVIEW, baseDocument } from './bases.js';

const STATE_VERSION = 1;
const MAX_QUOTE = 600;
const MARKER_START = '<!-- workbench:start -->';
const MARKER_END = '<!-- workbench:end -->';

/** Bound one string field. */
const text = (value, limit = 2000) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');

/** Turn any thrown value into a readable message. */
export function messageOf(error) {
  return error && typeof error.message === 'string' ? error.message : String(error);
}

/**
 * A vault-backed knowledge store.
 */
export class KnowledgeStore {
  #vault;
  #timeZone;
  #writes = Promise.resolve();

  /**
   * @param {object} options - store options.
   * @param {string} options.vault - absolute vault directory.
   * @param {string} [options.timeZone] - IANA zone used for dates.
   */
  constructor({ vault, timeZone }) {
    this.#vault = path.resolve(vault);
    this.#timeZone = timeZone;
  }

  /** Absolute vault directory. */
  get vault() { return this.#vault; }

  /** Inbox directory. */
  get inbox() { return path.join(this.#vault, 'inbox'); }

  /** Library directory. */
  get library() { return path.join(this.#vault, 'library'); }

  /** Brief directory. */
  get briefs() { return path.join(this.#vault, 'briefs'); }

  /** Machine directory. */
  get work() { return path.join(this.#vault, '.workbench'); }

  /** Today's date in the store's zone. */
  get today() { return localDate(new Date(), this.#timeZone); }

  /** IANA zone used for dates. */
  get timeZone() { return this.#timeZone; }

  /** Relative path helpers for the API surface. */
  get paths() {
    return {
      root: this.#vault,
      inbox: this.inbox,
      library: this.library,
      briefs: this.briefs,
      base: path.join(this.#vault, BASE_FILE),
      preferences: path.join(this.#vault, '偏好.md'),
      questions: path.join(this.#vault, '待研究.md'),
    };
  }

  /** Absolute path of a vault-relative POSIX path, refusing escapes. */
  absolute(relative) {
    const parts = String(relative).split('/');
    if (!relative || relative.startsWith('/') || parts.includes('..')) throw new Error('路径无效');
    return path.join(this.#vault, ...parts);
  }

  /** Whether the vault has been initialized. */
  async initialized() {
    try {
      const stat = await fs.stat(this.inbox);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /** Serialize one operation behind the write queue. */
  #serialize(operation) {
    const next = this.#writes.then(operation, operation);
    this.#writes = next.then(() => undefined, () => undefined);
    return next;
  }

  /** Write a file through a same-directory temporary file and rename. */
  async #writeFile(file, content) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temporary, content, 'utf8');
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  /** Read a text file, returning a fallback when it is missing. */
  async #read(file, fallback = '') {
    try {
      return await fs.readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return fallback;
      throw error;
    }
  }

  /** List Markdown files below a directory, recursively. */
  async #markdownFiles(directory) {
    const files = [];
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return files;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) files.push(...await this.#markdownFiles(file));
      else if (entry.name.endsWith('.md')) files.push(file);
    }
    return files.sort();
  }

  /** Create the vault skeleton and seed notes that do not exist yet. */
  async ensure() {
    return this.#serialize(async () => {
      await fs.mkdir(this.inbox, { recursive: true });
      await fs.mkdir(this.library, { recursive: true });
      await fs.mkdir(this.briefs, { recursive: true });
      await fs.mkdir(this.work, { recursive: true });
      await this.#seed(path.join(this.#vault, 'README.md'), vaultReadme());
      await this.#seed(this.paths.base, baseDocument());
      await this.#seed(this.paths.preferences, preferencesTemplate());
      await this.#seed(this.paths.questions, questionsTemplate());
      await this.#seed(path.join(this.work, 'state.json'), `${JSON.stringify(defaultState(), null, 2)}\n`);
      return this.paths;
    });
  }

  /**
   * Seed the Obsidian Bases file when it is missing. Never overwrites it, so
   * views and columns a person changed in Obsidian survive plugin updates.
   */
  async ensureBase() {
    if (!(await this.initialized())) return;
    await this.#seed(this.paths.base, baseDocument());
  }

  /**
   * Publish cards a person confirmed by editing `review` in Obsidian (for
   * example in the Bases table). Runs before every status snapshot; a card is
   * only accepted when its frontmatter `id` matches its file name.
   * @returns {Promise<number>} number of cards published by this scan.
   */
  async scanApprovals() {
    if (!(await this.initialized())) return 0;
    let entries;
    try {
      entries = await fs.readdir(this.inbox, { withFileTypes: true });
    } catch {
      return 0;
    }
    let published = 0;
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('.')) continue;
      const id = entry.name.slice(0, -3);
      if (!isCardId(id)) continue;
      let raw;
      try {
        raw = await this.#read(path.join(this.inbox, entry.name));
      } catch {
        continue;
      }
      const { meta } = parseNote(raw);
      if (text(meta.review, 20) !== CONFIRM_REVIEW) continue;
      if (String(meta.id || '') !== id) continue;
      try {
        await this.reviewCard(id, 'approve');
        published += 1;
      } catch {
        /* Leave it for the workbench: a missing id match or an existing library file. */
      }
    }
    return published;
  }

  /** Create one file only when it is missing. */
  async #seed(file, content) {
    try {
      await fs.writeFile(file, content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  /** Read the machine state, applying defaults for fields added later. */
  async readState() {
    const raw = await this.#read(path.join(this.work, 'state.json'));
    if (!raw.trim()) return defaultState();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('工作台状态文件损坏：.workbench/state.json');
    }
    return {
      ...defaultState(),
      ...parsed,
      version: STATE_VERSION,
      preferences: { ...defaultState().preferences, ...(parsed.preferences || {}) },
      followups: Array.isArray(parsed.followups) ? parsed.followups : [],
    };
  }

  /** Apply one change to the state and persist it. */
  async updateState(mutate) {
    return this.#serialize(async () => {
      const state = await this.readState();
      const next = (await mutate(state)) || state;
      await this.#writeFile(path.join(this.work, 'state.json'), `${JSON.stringify(next, null, 2)}\n`);
      return next;
    });
  }

  /** One-line summaries of the inbox, optionally filtered by review state or text. */
  async listCandidates({ status = 'all', query = '' } = {}) {
    const files = await this.#markdownFiles(this.inbox);
    const needle = String(query || '').trim().toLowerCase();
    const cards = [];
    for (const file of files) {
      const raw = await this.#read(file);
      const { meta, body } = parseNote(raw);
      const id = text(meta.id, 80) || path.basename(file, '.md');
      const review = text(meta.review, 20) || REVIEW.pending;
      const title = text(meta.title, 200) || firstHeading(body) || path.basename(file, '.md');
      if (status !== 'all' && status !== 'pending' && review !== status) continue;
      if (status === 'pending' && review !== REVIEW.pending && review !== '') continue;
      const haystack = `${title}\n${body}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      cards.push({
        id,
        title,
        review,
        created: text(meta.created, 20),
        approved: text(meta.approved, 40),
        tags: normalizeTags(meta.tags),
        excerpt: excerptOf(body),
        path: `inbox/${path.basename(file)}`,
      });
    }
    return cards.sort((left, right) => (right.created || '').localeCompare(left.created || '') || left.title.localeCompare(right.title, 'zh-CN'));
  }

  /** Locate one candidate by id. */
  async findCandidate(id) {
    if (!isCardId(id)) throw new Error('卡片 ID 无效');
    const file = path.join(this.inbox, `${id}.md`);
    const raw = await this.#read(file);
    return raw ? { file, raw } : null;
  }

  /** Read one candidate card with its full body. */
  async getCandidate(id) {
    const found = await this.findCandidate(id);
    if (!found) throw new Error('找不到这张候选卡片，可能已被处理');
    const { meta, body } = parseNote(found.raw);
    return {
      id,
      meta,
      body,
      title: text(meta.title, 200) || firstHeading(body) || id,
      review: text(meta.review, 20) || REVIEW.pending,
      tags: normalizeTags(meta.tags),
      path: `inbox/${id}.md`,
      absolute: found.file,
    };
  }

  /**
   * Write a new candidate card.
   * @param {object} input - card fields from the agent tool.
   * @returns {Promise<{id: string, title: string, path: string, review: string}>} the stored card.
   */
  async createCard(input) {
    const title = text(input.title, 120);
    const claim = text(input.claim, 1000);
    const explanation = text(input.explanation, 4000);
    const limits = text(input.limits, 1000);
    if (!title) throw new Error('卡片缺少标题');
    if (!claim) throw new Error('卡片缺少核心结论');
    if (!explanation) throw new Error('卡片缺少解释与运用');
    if (!limits) throw new Error('卡片缺少适用条件');
    const sources = [];
    for (const item of Array.isArray(input.sources) ? input.sources.slice(0, 5) : []) {
      const url = text(item && item.url, 2048);
      const quote = text(item && item.quote, MAX_QUOTE);
      if (!/^https?:\/\//i.test(url)) throw new Error('来源链接必须是 http(s) 地址');
      if (quote.length < 8) throw new Error('来源引文太短，请摘录原文');
      sources.push({ url, title: text(item && item.title, 200) || undefined, quote });
    }
    if (!sources.length) throw new Error('卡片至少需要一条原文来源与引文');
    const date = this.today;
    const id = newCardId(date);
    const review = REVIEW.pending;
    const content = renderCard({
      id, title, claim, explanation, limits, sources,
      created: date, review, tags: normalizeTags(input.tags),
      summary: claim.slice(0, 200),
      source_count: sources.length,
    });
    await this.#serialize(async () => {
      await fs.mkdir(this.inbox, { recursive: true });
      await fs.writeFile(path.join(this.inbox, `${id}.md`), content, { encoding: 'utf8', flag: 'wx' });
    });
    return { id, title, path: `inbox/${id}.md`, review };
  }

  /**
   * Apply one human review decision to a candidate.
   * @param {string} id - card id.
   * @param {'approve'|'hold'|'skip'|'pending'|'delete'} action - decision.
   * @returns {Promise<{id: string, review: string, path: string}>} the resulting location.
   */
  async reviewCard(id, action) {
    return this.#serialize(async () => {
      const found = await this.findCandidate(id);
      if (!found) throw new Error('找不到这张候选卡片，可能已被处理');
      const { meta, body } = parseNote(found.raw);
      if (action === 'delete') {
        const trash = path.join(this.work, 'trash');
        await fs.mkdir(trash, { recursive: true });
        await fs.rename(found.file, path.join(trash, `${id}-${Date.now()}.md`));
        return { id, review: '已删除', path: '' };
      }
      if (action === 'approve') {
        const destination = path.join(this.library, `${id}.md`);
        if (await exists(destination)) throw new Error('这张卡已经入库，请直接查看知识库');
        const approvedAt = new Date().toISOString();
        const republished = [
          renderFrontmatter({
            ...meta,
            id,
            review: REVIEW.approved,
            approved: approvedAt,
            updated: approvedAt,
          }).trimEnd(),
          '',
          body.replace(/\r\n/g, '\n').trim(),
          '',
        ].join('\n');
        await fs.mkdir(this.library, { recursive: true });
        await fs.writeFile(destination, republished, { encoding: 'utf8' });
        await fs.rm(found.file, { force: true });
        const state = await this.readState();
        state.receipts = { ...(state.receipts || {}), [id]: { approvedAt, path: `library/${id}.md` } };
        await this.#writeFile(path.join(this.work, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
        return { id, review: REVIEW.approved, path: `library/${id}.md` };
      }
      const review = action === 'hold' ? REVIEW.hold : action === 'skip' ? REVIEW.skip : REVIEW.pending;
      const updated = renderFrontmatter({ ...meta, id, review }).trimEnd() + '\n' + body;
      await fs.writeFile(found.file, updated, 'utf8');
      return { id, review, path: `inbox/${id}.md` };
    });
  }

  /** One-line summaries of the permanent library. */
  async listLibrary({ query = '', limit = 400 } = {}) {
    const files = await this.#markdownFiles(this.library);
    const needle = String(query || '').trim().toLowerCase();
    const notes = [];
    for (const file of files) {
      const raw = await this.#read(file);
      if (!raw) continue;
      const { meta, body } = parseNote(raw);
      const relative = path.relative(this.library, file).split(path.sep).join('/');
      const title = text(meta.title, 200) || firstHeading(body) || path.basename(file, '.md');
      const haystack = `${title}\n${raw}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      notes.push({
        id: encodeNoteId(relative),
        title,
        created: text(meta.created, 20) || text(meta.approved, 40).slice(0, 10),
        tags: normalizeTags(meta.tags),
        excerpt: excerptOf(body),
        path: `library/${relative}`,
      });
    }
    return notes
      .sort((left, right) => (right.created || '').localeCompare(left.created || '') || left.title.localeCompare(right.title, 'zh-CN'))
      .slice(0, limit);
  }

  /** Read one library note by its encoded id. */
  async getLibraryNote(id) {
    const relative = decodeNoteId(id);
    const file = path.join(this.library, ...relative.split('/'));
    const raw = await this.#read(file);
    if (!raw) throw new Error('找不到这篇笔记，可能已被移动或删除');
    const { meta, body } = parseNote(raw);
    return {
      id,
      meta,
      body,
      title: text(meta.title, 200) || firstHeading(body) || relative,
      tags: normalizeTags(meta.tags),
      created: text(meta.created, 20),
      path: `library/${relative}`,
      readPath: file,
    };
  }

  /** Search inbox and library, ranking title hits above body hits. */
  async search({ query, scope = 'all', limit = 8 }) {
    const needle = text(query, 200);
    if (!needle) throw new Error('请输入搜索词');
    const lower = needle.toLowerCase();
    const results = [];
    if (scope !== 'library') {
      for (const card of await this.listCandidates({ status: 'all', query: needle })) {
        results.push({
          scope: 'inbox', id: card.id, title: card.title, excerpt: card.excerpt,
          review: card.review, path: card.path,
          score: Math.min(9, (card.title.toLowerCase().includes(lower) ? 6 : 2)),
        });
      }
    }
    if (scope !== 'inbox') {
      for (const note of await this.listLibrary({ query: needle })) {
        results.push({
          scope: 'library', id: note.id, title: note.title, excerpt: note.excerpt,
          review: REVIEW.approved, path: note.path,
          score: Math.min(9, (note.title.toLowerCase().includes(lower) ? 6 : 2)),
        });
      }
    }
    return results
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'zh-CN'))
      .slice(0, Math.max(1, Math.min(20, Number(limit) || 8)))
      .map(({ score, ...row }) => row);
  }

  /** Persist user preferences and mirror them into 偏好.md. */
  async savePreferences(input) {
    const topicsValue = Array.isArray(input.topics) ? input.topics : String(input.topics || '').split(/[,，、;；\n]/);
    const topics = [];
    for (const raw of topicsValue) {
      const topic = text(raw, 120);
      if (topic && !topics.includes(topic)) topics.push(topic);
      if (topics.length === 8) break;
    }
    const preferences = {
      topics,
      level: text(input.level, 1000),
      goal: text(input.goal, 1000),
      style: text(input.style, 1000),
      avoid: text(input.avoid, 1000),
    };
    const state = await this.updateState(current => {
      current.preferences = { ...current.preferences, ...preferences };
      return current;
    });
    await this.#mirrorPreferences(state);
    return state.preferences;
  }

  /** Rewrite the human-facing preference mirror. */
  async #mirrorPreferences(state) {
    const file = this.paths.preferences;
    const current = await this.#read(file);
    const block = [
      MARKER_START,
      '## 兴趣方向',
      '',
      state.preferences.topics.length ? state.preferences.topics.map(topic => `- ${topic}`).join('\n') : '（尚未设置）',
      '',
      '## 已有基础',
      '',
      state.preferences.level || '（尚未设置）',
      '',
      '## 学习目标',
      '',
      state.preferences.goal || '（尚未设置）',
      '',
      '## 阅读习惯',
      '',
      state.preferences.style || '（尚未设置）',
      '',
      '## 减少推荐',
      '',
      state.preferences.avoid || '（尚未设置）',
      MARKER_END,
    ].join('\n');
    const previousBlock = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`);
    const next = previousBlock.test(current)
      ? current.replace(previousBlock, () => block)
      : `${preferencesTemplate()}\n${block}\n`;
    if (next !== current) await this.#writeFile(file, next);
  }

  /** Active research questions, newest last. */
  async listFollowups() {
    const state = await this.readState();
    return (Array.isArray(state.followups) ? state.followups : [])
      .filter(item => item && !item.removedAt && !item.usedAt)
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  }

  /** Add one research question, collapsing duplicates and bounds. */
  async addFollowup(question, cardId) {
    const value = text(question, 500);
    if (!value) throw new Error('请输入一个具体的研究问题');
    return this.updateState(state => {
      const existing = state.followups.find(item => !item.removedAt && !item.usedAt && item.question === value);
      if (existing) return state;
      const item = {
        id: `q-${randomBytes(4).toString('hex')}`,
        question: value,
        cardId: cardId && isCardId(cardId) ? cardId : undefined,
        createdAt: new Date().toISOString(),
      };
      state.followups = [...state.followups.filter(entry => !entry.removedAt), item].slice(-50);
      return state;
    }).then(state => {
      const item = state.followups.find(entry => entry.question === value);
      return { ...item, total: state.followups.filter(entry => !entry.removedAt && !entry.usedAt).length };
    }).then(async item => {
      await this.#mirrorQuestions();
      return item;
    });
  }

  /** Mark one research question removed. */
  async removeFollowup(id) {
    const state = await this.updateState(current => {
      const found = current.followups.find(item => item.id === id);
      if (!found) throw new Error('找不到这个研究问题');
      found.removedAt = new Date().toISOString();
      return current;
    });
    await this.#mirrorQuestions();
    return state.followups.filter(item => !item.removedAt && !item.usedAt);
  }

  /** Rewrite the human-facing question list. */
  async #mirrorQuestions() {
    const items = await this.listFollowups();
    const file = this.paths.questions;
    const current = await this.#read(file);
    const block = [
      MARKER_START,
      items.length ? items.map(item => `- ${item.question}`).join('\n') : '（暂无待研究问题）',
      MARKER_END,
    ].join('\n');
    const previousBlock = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`);
    const next = previousBlock.test(current)
      ? current.replace(previousBlock, () => block)
      : `${questionsTemplate()}\n${block}\n`;
    if (next !== current) await this.#writeFile(file, next);
  }

  /** Pull question bullets a person appended to 待研究.md into the queue. */
  async syncVaultQuestions() {
    const raw = await this.#read(this.paths.questions);
    const match = raw.match(new RegExp(`${MARKER_START}([\\s\\S]*?)${MARKER_END}`));
    if (!match) return;
    const bullets = match[1].split('\n')
      .map(line => line.match(/^\s*[-*]\s+(.+)$/))
      .filter(Boolean)
      .map(found => text(found[1], 500))
      .filter(Boolean);
    if (!bullets.length) return;
    const state = await this.readState();
    const known = new Set(state.followups.map(item => item.question));
    const fresh = bullets.filter(question => !known.has(question));
    if (!fresh.length) return;
    await this.updateState(current => {
      for (const question of fresh) {
        if (current.followups.some(item => item.question === question)) continue;
        current.followups.push({
          id: `q-${randomBytes(4).toString('hex')}`,
          question,
          createdAt: new Date().toISOString(),
          source: 'vault',
        });
      }
      current.followups = current.followups.slice(-50);
      return current;
    });
    await this.#mirrorQuestions();
  }

  /** Write one day's research brief and remember it. */
  async writeBrief({ date, focus, summary, nextQuestions = [] }) {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : this.today;
    const headline = text(focus, 300);
    const body = text(summary, 20000);
    if (!headline) throw new Error('研究简报缺少今日重点');
    if (!body) throw new Error('研究简报缺少内容');
    const questions = (Array.isArray(nextQuestions) ? nextQuestions : [])
      .map(item => text(item, 300))
      .filter(Boolean)
      .slice(0, 5);
    const content = [
      renderFrontmatter({
        kind: 'brief',
        date: day,
        focus: headline,
        question_count: questions.length,
        created: this.today,
      }).trimEnd(),
      '',
      `# ${day} · 今日研究`,
      '',
      '## 今日重点',
      '',
      headline,
      '',
      '## 研究记录',
      '',
      body,
      '',
      '## 接着探索',
      '',
      questions.length ? questions.map(question => `- ${question}`).join('\n') : '（暂无）',
      '',
    ].join('\n');
    const relative = `briefs/${day}.md`;
    await this.#writeFile(path.join(this.briefs, `${day}.md`), content);
    await this.updateState(state => {
      state.lastBrief = { date: day, path: relative };
      return state;
    });
    return { date: day, path: relative, focus: headline, nextQuestions: questions };
  }

  /** One-line summaries of every brief, newest first. */
  async listBriefs() {
    const files = await this.#markdownFiles(this.briefs);
    const briefs = [];
    for (const file of files) {
      const raw = await this.#read(file);
      const { meta, body } = parseNote(raw);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(meta.date || '')) ? meta.date : path.basename(file, '.md');
      const title = firstHeading(body) || date;
      const focus = text(meta.focus, 300) || sectionLine(body, '今日重点') || excerptOf(body);
      briefs.push({ date, title, focus, path: `briefs/${date}.md`, excerpt: excerptOf(body) });
    }
    return briefs.sort((left, right) => right.date.localeCompare(left.date));
  }

  /** Read one brief. */
  async getBrief(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('日期无效');
    const file = path.join(this.briefs, `${date}.md`);
    const raw = await this.#read(file);
    if (!raw) throw new Error('找不到这份研究简报');
    const { body } = parseNote(raw);
    return { date, title: firstHeading(body) || date, body, path: `briefs/${date}.md`, absolute: file };
  }

  /** Counts and the small lists the panel and tools read on every view. */
  async status() {
    await this.ensureBase();
    await this.scanApprovals();
    await this.syncVaultQuestions();
    const [cards, library, briefs, state, initialized] = await Promise.all([
      this.listCandidates({ status: 'all' }),
      this.listLibrary({ limit: 1000 }),
      this.listBriefs(),
      this.readState(),
      this.initialized(),
    ]);
    const count = review => cards.filter(card => card.review === review).length;
    return {
      vault: this.vault,
      paths: this.paths,
      initialized,
      date: this.today,
      timeZone: this.timeZone,
      counts: {
        inbox: cards.length,
        pending: count(REVIEW.pending),
        hold: count(REVIEW.hold),
        skip: count(REVIEW.skip),
        library: library.length,
        followups: state.followups.filter(item => !item.removedAt && !item.usedAt).length,
      },
      cards,
      library,
      briefs,
      preferences: state.preferences,
      followups: state.followups.filter(item => !item.removedAt && !item.usedAt),
      lastBrief: state.lastBrief || null,
    };
  }
}

/**
 * First Markdown heading in a body.
 * @param {string} body - Markdown.
 * @returns {string} heading text or an empty string.
 */
export function firstHeading(body) {
  const match = String(body).match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

/** Whether a path exists as a regular file. */
async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** The encrypted-at-rest-free default state. */
function defaultState() {
  return {
    version: STATE_VERSION,
    preferences: { topics: [], level: '', goal: '', style: '', avoid: '' },
    followups: [],
    dailyAt: '09:00',
    researchScheduleId: null,
    pendingRun: null,
    lastBrief: null,
    receipts: {},
  };
}

/** Seed text for a new vault's README. */
function vaultReadme() {
  return `# 悟 · 知识工作台

这个目录由 DeepSeek Harness 的「知识工作台」插件维护，同时可以用 Obsidian 直接打开。

| 位置 | 内容 |
| --- | --- |
| \`知识工作台.base\` | Obsidian Bases 数据库：待审阅、收件箱、知识库、研究简报。 |
| \`inbox/\` | 待审阅的候选卡片。agent 查资料后写在这里。 |
| \`library/\` | 你确认入库的正式知识笔记。 |
| \`briefs/\` | 每天的研究简报。 |
| \`偏好.md\` | 兴趣、基础、目标、阅读习惯的镜像。 |
| \`待研究.md\` | 后续研究问题的镜像；在这里追加 \`- 问题\` 也会进入队列。 |

审阅规则：候选卡片顶部有 \`review\` 属性。在知识工作台里点「确认入库」，或在
[[知识工作台.base]] 的表格里把 \`review\` 改成「确认」，下一次刷新工作台时会被收录到
\`library/\`。卡片只是 Markdown，可以自由编辑、移动和提交到 git。
`;
}

/** Seed text for the preference mirror. */
function preferencesTemplate() {
  return `# 悟 · 用户偏好

> 这份笔记由「悟 · 知识工作台」插件维护。你也可以直接在知识工作台页面修改。

`;
}

/** Seed text for the question mirror. */
function questionsTemplate() {
  return `# 悟 · 待研究问题

> 在下面追加 \`- 你的问题\`，下一次打开工作台时会进入研究队列。

`;
}
