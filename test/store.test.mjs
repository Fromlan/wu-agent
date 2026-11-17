/**
 * Store and browser-API tests for the knowledge workbench Host half.
 * Run with: node --test dsh-plugin/test/
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import { KnowledgeStore } from '../lib/store.js';
import { createRouter, ROUTE } from '../index.js';
import { createToolDefinitions } from '../lib/tools.js';
import { BASE_FILE } from '../lib/bases.js';
import { PROMPT_LIMIT, RESEARCH_PROMPT_REVISION, dailyPrompt, normalizePrompt, nowPrompt, promptBody } from '../lib/research.js';

const ORIGIN = 'http://127.0.0.1:4317';
const DAY = '2026-11-17';

/** One temp vault per test file. */
let root;
let store;

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-kbw-'));
  store = new KnowledgeStore({ vault: path.join(root, 'vault'), timeZone: 'Asia/Shanghai' });
  await store.ensure();
});

after(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Build one candidate input with a plausible source. */
function cardInput(overrides = {}) {
  return {
    title: '批处理在延迟允许时比逐条查询更省',
    takeaway: '延迟可接受时，把 N 次往返合并成一次批处理。',
    scene: '你在做离线报表时，逐条查 1000 次，每次都付一次往返开销；把 N 次查询合并成一次批量请求，总延迟明显下降。',
    why: '批处理把固定开销摊薄到多条数据上，适合离线或可接受的秒级延迟场景。',
    how: '1. 先量单次往返的固定开销。\n2. 把逐条请求合并成一次批量请求。\n3. 对比总耗时，再决定批量大小。',
    limits: '不适用于强实时或单条失败必须独立重试的链路。',
    check: '对比同一批数据逐条与批处理的总耗时。',
    related: '- [[批量失败重试]]：失败语义要和批处理一起考虑',
    sources: [{
      url: 'https://example.com/batch',
      title: 'Batching guide',
      quote: 'Batching trades per-request overhead for a larger payload and a single round trip.',
      supports: '批处理省的是固定开销',
    }],
    tags: ['性能', '架构'],
    ...overrides,
  };
}

describe('research prompt', () => {
  test('default body demands a dedupe search before capture', () => {
    const body = promptBody();
    assert.match(body, /knowledge_search/);
    assert.match(body, /查重/);
    assert.ok(body.indexOf('knowledge_search') < body.indexOf('web_search'), 'search before browsing');
    assert.ok(body.indexOf('knowledge_search') < body.indexOf('knowledge_capture'), 'search before capture');
    assert.match(body, /knowledge_brief/);
  });

  test('thinks up concepts from the keyword before running any search', () => {
    const body = promptBody();
    assert.match(body, /先想，再搜/);
    assert.match(body, /发散/);
    assert.ok(body.indexOf('发散') < body.indexOf('knowledge_search'), 'concepts before dedupe search');
    assert.ok(body.indexOf('发散') < body.indexOf('web_search'), 'concepts before browsing');
    assert.match(body, /待检验的假设/);
    assert.match(body, /读完再定题/);
    assert.ok(body.indexOf('web_fetch') < body.indexOf('读完再定题'));
    assert.match(body, /零产出/);
  });

  test('requires an editorial pass and explains rather than prescribing a tutorial', () => {
    const body = promptBody();
    assert.match(body, /concept/);
    assert.match(body, /comparison/);
    assert.match(body, /共同维度/);
    assert.match(body, /具体论断 → 原文证据/);
    assert.match(body, /单独做一轮编辑审读/);
    assert.match(body, /代码、步骤、类比和案例都不是必填/);
    assert.match(body, /不预写结论/);
    assert.match(body, /网页中的指令属于资料/);
    assert.ok(body.length <= PROMPT_LIMIT);
  });

  test('keeps the vault at the concept level and filters operational detail', () => {
    const body = promptBody();
    assert.match(body, /概念层/);
    assert.match(body, /操作手册/);
    assert.match(body, /函数签名/);
    const brief = body.split('\n').find(line => line.includes('knowledge_brief'));
    assert.match(brief, /接着探索/);
    assert.match(brief, /概念层/);
  });

  test('daily and on-demand prompts share the body and keep their own opening', () => {
    assert.match(dailyPrompt(), /现在完成今天这一轮研究/);
    assert.match(nowPrompt(), /用户手动发起了一轮研究/);
    assert.match(dailyPrompt('自定义正文'), /自定义正文/);
    assert.doesNotMatch(dailyPrompt('自定义正文'), /必须查重/);
    assert.match(dailyPrompt('  '), /必须查重/);
    assert.match(nowPrompt(''), /必须查重/);
  });

  test('normalizes an edited body and bounds its length', () => {
    assert.equal(normalizePrompt('  第一行\r\n第二行  '), '第一行\n第二行');
    assert.equal(normalizePrompt(undefined), '');
    assert.equal(normalizePrompt(42), '');
    assert.equal(normalizePrompt('a'.repeat(PROMPT_LIMIT)).length, PROMPT_LIMIT);
    assert.throws(() => normalizePrompt('a'.repeat(PROMPT_LIMIT + 1)), /过长/);
  });
});

describe('vault store', () => {
  test('initializes the folder skeleton and seed notes', async () => {
    for (const name of ['inbox', 'library', 'briefs', '.workbench']) {
      const stat = await fs.stat(path.join(store.vault, name));
      assert.equal(stat.isDirectory(), true, name);
    }
    const readme = await fs.readFile(path.join(store.vault, 'README.md'), 'utf8');
    assert.match(readme, /知识工作台/);
    assert.equal(await store.initialized(), true);
  });

  test('seeds an Obsidian Bases database and never overwrites edits', async () => {
    const base = path.join(store.vault, BASE_FILE);
    const seeded = await fs.readFile(base, 'utf8');
    assert.match(seeded, /^# 悟 · 知识工作台数据库/);
    assert.match(seeded, /views:/);
    assert.match(seeded, /name: 待审阅/);
    assert.match(seeded, /name: 知识库/);
    assert.match(seeded, /file\.inFolder\("inbox"\)/);
    assert.match(seeded, /note\.review == "待审阅"/);
    assert.match(seeded, /type: cards/);
    await fs.writeFile(base, seeded + '# 用户自己加的视图\n', 'utf8');
    await store.ensure();
    const after = await fs.readFile(base, 'utf8');
    assert.match(after, /用户自己加的视图/);
    await fs.writeFile(base, seeded, 'utf8');
  });

  test('recreates a deleted Bases file on the next status snapshot', async () => {
    const base = path.join(store.vault, BASE_FILE);
    await fs.rm(base, { force: true });
    await store.status();
    const recreated = await fs.readFile(base, 'utf8');
    assert.match(recreated, /name: 待审阅/);
  });

  test('captures a card into the inbox with database properties and evidence', async () => {
    const created = await store.createCard(cardInput());
    assert.match(created.id, /^kb-\d{8}-[a-f0-9]{6}$/);
    assert.equal(created.review, '待审阅');
    const file = path.join(store.inbox, `${created.id}.md`);
    const raw = await fs.readFile(file, 'utf8');
    assert.match(raw, /^---\n/);
    assert.match(raw, /review: "待审阅"/);
    assert.match(raw, /aliases: \["批处理在延迟允许时比逐条查询更省"\]/);
    assert.match(raw, /summary: "延迟可接受时，把 N 次往返合并成一次批处理。"/);
    assert.match(raw, /source_count: 1/);
    assert.match(raw, /sources: \["https:\/\/example\.com\/batch"\]/);
    assert.match(raw, /## 场景/);
    assert.match(raw, /## 原理/);
    assert.match(raw, /## 做法/);
    assert.match(raw, /## 边界与取舍/);
    assert.match(raw, /## 怎么验证/);
    assert.match(raw, /## 关联/);
    assert.match(raw, /支撑「批处理省的是固定开销」/);
    assert.match(raw, /Batching trades per-request overhead/);
    assert.doesNotMatch(raw, /## 核心结论/);
    assert.doesNotMatch(raw, /## 为什么/);
    assert.doesNotMatch(raw, /## 怎么用/);
    const body = await store.getCandidate(created.id);
    assert.equal(body.title, cardInput().title);
    assert.equal(body.tags.length, 2);
  });

  test('rejects cards without the required parts', async () => {
    await assert.rejects(() => store.createCard(cardInput({ takeaway: '' })), /所以呢/);
    await assert.rejects(() => store.createCard(cardInput({ scene: '' })), /场景/);
    await assert.rejects(() => store.createCard(cardInput({ why: '' })), /原理/);
    await assert.rejects(() => store.createCard(cardInput({ how: '' })), /做法/);
    await assert.rejects(() => store.createCard(cardInput({ limits: '' })), /边界与取舍/);
    await assert.rejects(() => store.createCard(cardInput({ check: '' })), /怎么验证/);
  });

  test('rejects cards without verifiable evidence', async () => {
    await assert.rejects(() => store.createCard(cardInput({ sources: [] })), /原文来源/);
    await assert.rejects(() => store.createCard(cardInput({
      sources: [{ url: 'https://example.com/x', quote: 'short' }],
    })), /引文太短/);
    await assert.rejects(() => store.createCard(cardInput({
      sources: [{ url: 'file:///etc/passwd', quote: 'a long enough quote' }],
    })), /http/);
  });

  test('keeps a long takeaway whole instead of slicing it', async () => {
    const takeaway = '甲'.repeat(220);
    const created = await store.createCard(cardInput({ title: '长摘要测试卡', takeaway }));
    const raw = await fs.readFile(path.join(store.inbox, `${created.id}.md`), 'utf8');
    assert.ok(raw.includes(takeaway), 'takeaway must not be truncated');
    assert.ok(raw.includes(`summary: "${takeaway}"`), 'summary carries the whole takeaway');
  });

  test('refuses a card whose title already exists in the inbox or library', async () => {
    const created = await store.createCard(cardInput({ title: '重复标题检查卡' }));
    await assert.rejects(() => store.createCard(cardInput({ title: '重复标题检查卡' })), /收件箱已有/);
    await assert.rejects(() => store.createCard(cardInput({ title: '重复 标题检查卡' })), /收件箱已有/);
    await store.reviewCard(created.id, 'approve');
    await assert.rejects(() => store.createCard(cardInput({ title: '重复标题检查卡' })), /知识库已有/);
  });

  test('still lists legacy cards that lead with 核心结论', async () => {
    const id = 'kb-20261117-legacy1';
    const file = path.join(store.inbox, `${id}.md`);
    await fs.writeFile(file, [
      '---',
      `id: "${id}"`,
      'kind: "card"',
      'title: "旧格式卡"',
      'review: "待审阅"',
      'summary: "旧摘要"',
      '---',
      '# 旧格式卡',
      '',
      '## 核心结论',
      '',
      '旧卡的核心结论。',
      '',
      '## 来源',
      '',
      '1. [旧来源](https://example.com/legacy)',
      '',
      '   > 一段足够长的旧引文。',
      '',
      '',
    ].join('\n'), 'utf8');
    const listed = (await store.listCandidates({ status: 'all' })).find(card => card.id === id);
    assert.ok(listed);
    assert.equal(listed.excerpt, '旧卡的核心结论。');
    await fs.rm(file, { force: true });
  });

  test('holds and skips without losing the card', async () => {
    const created = await store.createCard(cardInput({ title: '暂缓测试卡' }));
    const held = await store.reviewCard(created.id, 'hold');
    assert.equal(held.review, '暂缓');
    const card = await store.getCandidate(created.id);
    assert.equal(card.review, '暂缓');
    await store.reviewCard(created.id, 'skip');
    assert.equal((await store.getCandidate(created.id)).review, '跳过');
    const restored = await store.reviewCard(created.id, 'pending');
    assert.equal(restored.review, '待审阅');
    await store.reviewCard(created.id, 'delete');
    await assert.rejects(() => store.getCandidate(created.id), /找不到/);
  });

  test('approves a card into the library and reads it back by note id', async () => {
    const created = await store.createCard(cardInput({ title: '入库测试卡' }));
    const published = await store.reviewCard(created.id, 'approve');
    assert.equal(published.path, `library/${created.id}.md`);
    const raw = await fs.readFile(path.join(store.library, `${created.id}.md`), 'utf8');
    assert.match(raw, /review: "已入库"/);
    assert.match(raw, /approved: "/);
    assert.match(raw, /source_count: 1\n/);
    assert.match(raw, /## 怎么验证/);
    assert.doesNotMatch(raw, /把顶部 review 改成/);
    const notes = await store.listLibrary({ query: '入库测试' });
    assert.equal(notes.length, 1);
    const note = await store.getLibraryNote(notes[0].id);
    assert.match(note.body, /入库测试卡/);
    await assert.rejects(() => store.reviewCard(created.id, 'approve'), /找不到/);
  });

  test('publishes a card confirmed in Obsidian Bases by editing review', async () => {
    const created = await store.createCard(cardInput({ title: 'Bases 确认测试卡' }));
    const file = path.join(store.inbox, `${created.id}.md`);
    const raw = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, raw.replace('review: "待审阅"', 'review: "确认"'), 'utf8');
    await store.status();
    await assert.rejects(() => store.getCandidate(created.id), /找不到/);
    const notes = await store.listLibrary({ query: 'Bases 确认测试' });
    assert.equal(notes.length, 1);
    const published = await fs.readFile(path.join(store.library, `${created.id}.md`), 'utf8');
    assert.match(published, /review: "已入库"/);
  });

  test('ignores a confirmed inbox file whose id does not match its name', async () => {
    const id = 'kb-20261117-dead01';
    const file = path.join(store.inbox, `${id}.md`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '---\nid: "kb-mismatch"\nreview: "确认"\n---\n# 不属于这张卡\n', 'utf8');
    await store.status();
    const stat = await fs.stat(file);
    assert.equal(stat.isFile(), true);
    assert.equal((await store.listLibrary({ query: '不属于这张卡' })).length, 0);
    await fs.rm(file, { force: true });
  });

  test('persists preferences and mirrors them for Obsidian', async () => {
    const preferences = await store.savePreferences({
      topics: ['分布式系统', '产品设计', '分布式系统'],
      level: '有后端基础',
      goal: '把研究转成可复用的设计判断',
      style: '先结论后推导',
      avoid: '营销式内容',
    });
    assert.deepEqual(preferences.topics, ['分布式系统', '产品设计']);
    const mirror = await fs.readFile(path.join(store.vault, '偏好.md'), 'utf8');
    assert.match(mirror, /分布式系统/);
    assert.match(mirror, /先结论后推导/);
    const state = await store.readState();
    assert.equal(state.preferences.goal, '把研究转成可复用的设计判断');
  });

  test('queues, deduplicates, and removes research questions', async () => {
    const first = await store.addFollowup('批处理什么时候反而更慢？', undefined);
    const again = await store.addFollowup('批处理什么时候反而更慢？', undefined);
    assert.equal(again.id, first.id);
    assert.equal((await store.listFollowups()).length, 1);
    await store.addFollowup('如何度量知识复用？', undefined);
    assert.equal((await store.listFollowups()).length, 2);
    const left = await store.removeFollowup(first.id);
    assert.equal(left.length, 1);
    const mirror = await fs.readFile(path.join(store.vault, '待研究.md'), 'utf8');
    assert.match(mirror, /如何度量知识复用/);
    assert.doesNotMatch(mirror, /批处理什么时候反而更慢/);
  });

  test('picks up questions appended in Obsidian', async () => {
    const file = path.join(store.vault, '待研究.md');
    const raw = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, raw.replace(/<!-- workbench:end -->/, '- 从笔记追加的问题？\n<!-- workbench:end -->'), 'utf8');
    await store.syncVaultQuestions();
    const questions = (await store.listFollowups()).map(item => item.question);
    assert.ok(questions.includes('从笔记追加的问题？'));
  });

  test('writes, lists, and reads a daily brief', async () => {
    const brief = await store.writeBrief({
      date: DAY,
      focus: '批处理的边界',
      summary: '读了两篇关于批处理开销的文章。',
      nextQuestions: ['批量大小如何影响尾延迟？'],
    });
    assert.equal(brief.path, `briefs/${DAY}.md`);
    const briefs = await store.listBriefs();
    assert.equal(briefs[0].date, DAY);
    const rawBrief = await fs.readFile(path.join(store.briefs, `${DAY}.md`), 'utf8');
    assert.match(rawBrief, /^---\n/);
    assert.match(rawBrief, /kind: "brief"/);
    assert.match(rawBrief, /question_count: 1/);
    assert.match(rawBrief, /focus: "批处理的边界"/);
    const read = await store.getBrief(DAY);
    assert.match(read.body, /批量大小如何影响尾延迟/);
    await assert.rejects(() => store.getBrief('not-a-date'), /日期无效/);
  });

  test('searches across inbox and library', async () => {
    const results = await store.search({ query: '批处理', scope: 'all', limit: 10 });
    assert.ok(results.length >= 1);
    assert.ok(results.every(result => ['inbox', 'library'].includes(result.scope)));
    await assert.rejects(() => store.search({ query: '  ' }), /搜索词/);
  });

  test('reports status counts without leaking full bodies', async () => {
    const status = await store.status();
    assert.equal(typeof status.counts.inbox, 'number');
    assert.ok(status.counts.library >= 1);
    assert.ok(Array.isArray(status.cards));
    assert.equal('body' in status.cards[0], false);
    assert.ok(Array.isArray(status.preferences.topics));
    assert.match(status.paths.base, /知识工作台\.base$/);
  });
});

describe('agent tools', () => {
  test('every definition has the registry shape the tools service requires', () => {
    const definitions = createToolDefinitions(store);
    assert.equal(definitions.length, 6);
    for (const definition of definitions) {
      assert.equal(typeof definition.name, 'string');
      assert.ok(definition.description.length > 20, definition.name);
      assert.equal(definition.parameters.type, 'object');
      assert.equal(typeof definition.parameters.properties, 'object');
      assert.equal(definition.output.schema.type, 'object');
      assert.equal(typeof definition.output.render, 'function');
      assert.equal(typeof definition.execute, 'function');
    }
  });

  test('capture asks for a concept article and evidence mapping without mandatory tutorial fields', () => {
    const capture = createToolDefinitions(store).find(tool => tool.name === 'knowledge_capture');
    for (const key of ['type', 'title', 'takeaway', 'question', 'definition', 'mechanism', 'comparison', 'subjects', 'limits', 'evidenceNote', 'reviewNote', 'related', 'sources']) {
      assert.ok(capture.parameters.properties[key], `missing ${key}`);
    }
    assert.deepEqual(capture.parameters.required, ['type', 'title', 'takeaway', 'question', 'definition', 'mechanism', 'limits', 'evidenceNote', 'reviewNote', 'sources']);
    for (const key of ['scene', 'why', 'how', 'check']) assert.equal(capture.parameters.properties[key], undefined);
    assert.ok(capture.parameters.properties.sources.items.properties.supports);
    assert.ok(capture.parameters.properties.sources.items.required.includes('supports'));
    assert.equal(capture.parameters.properties.claim, undefined);
    assert.equal(capture.parameters.properties.explanation, undefined);
  });

  test('status executes and reports preferences, counts, and paths', async () => {
    const status = createToolDefinitions(store).find(tool => tool.name === 'knowledge_status');
    const value = await status.execute({}, {});
    assert.equal(value.initialized, true);
    assert.equal(typeof value.counts.library, 'number');
    assert.equal(Array.isArray(value.preferences.topics), true);
    assert.match(value.paths.inbox, /inbox$/);
    assert.match(value.paths.base, /知识工作台\.base$/);
    const blocks = status.output.render({}, value);
    assert.equal(blocks[0].type, 'text');
    assert.match(blocks[0].text, /待审阅 \d+/);
    assert.match(blocks[0].text, /Obsidian 数据库/);
    assert.match(blocks[0].text, /确认入库只能由用户/);
    assert.ok(blocks[0].text.includes(`阅读基础：${value.preferences.level}`));
    for (const brief of value.recentBriefs) assert.ok(blocks[0].text.includes(brief.focus));
  });

  test('capture, search, read, ask, and brief execute end to end', async () => {
    const tools = Object.fromEntries(createToolDefinitions(store).map(tool => [tool.name, tool]));
    const created = await tools.knowledge_capture.execute(cardInput({ title: '工具链路验证卡' }), {});
    assert.match(created.id, /^kb-/);
    assert.equal(created.review, '待审阅');
    const found = await tools.knowledge_search.execute({ query: '工具链路', scope: 'inbox', limit: 5 }, {});
    assert.ok(found.matches.some(match => match.id === created.id));
    const read = await tools.knowledge_read.execute({ id: created.id }, {});
    assert.match(read.body, /## 场景/);
    assert.match(read.body, /## 原理/);
    assert.match(read.body, /## 怎么验证/);
    assert.match(tools.knowledge_read.output.render({ id: created.id }, read)[0].text, /工具链路验证卡/);
    const queued = await tools.knowledge_ask.execute({ question: '工具链路的下一步？' }, {});
    assert.equal(typeof queued.total, 'number');
    assert.match(tools.knowledge_ask.output.render({}, queued)[0].text, /工具链路的下一步/);
    const brief = await tools.knowledge_brief.execute({ focus: '工具链路', summary: '执行了五个知识工具。' }, {});
    assert.match(brief.path, /^briefs\//);
  });
});

describe('browser api', () => {
  let router;
  const scheduleCalls = [];

  /** A schedule service stub that records requests. */
  const schedule = {
    async view({ id }) {
      return { id, status: 'active', scheduledAt: new Date(Date.now() + 10000).toISOString() };
    },
    async create(request) {
      scheduleCalls.push({ kind: 'create', request });
      return { id: 'schedule-1', scheduledAt: new Date(Date.now() + 10000).toISOString() };
    },
    async edit(request) {
      scheduleCalls.push({ kind: 'edit', request });
      return { id: request.id };
    },
  };

  before(() => {
    router = createRouter({
      store,
      origin: () => ORIGIN,
      authorize: () => 0,
      schedule: () => schedule,
    });
  });

  /** Run one request against the router and return the parsed response. */
  async function request(method, pathname, body, headers = {}) {
    const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
    const req = Readable.from(chunks);
    req.method = method;
    req.url = `${ROUTE}${pathname}`;
    req.headers = { host: '127.0.0.1:4317', 'content-type': 'application/json', ...headers };
    const response = {
      status: 0,
      headers: {},
      body: '',
      headersSent: false,
      writeHead(status, responseHeaders) {
        this.status = status;
        this.headers = responseHeaders;
        this.headersSent = true;
      },
      end(value) {
        this.body = value || '';
      },
    };
    await router(req, response);
    return { status: response.status, headers: response.headers, body: JSON.parse(response.body) };
  }

  test('GET /state returns the workbench snapshot', async () => {
    const result = await request('GET', '/state');
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.ok(result.body.cards.length >= 0);
    assert.equal(result.body.config.vault, store.vault);
    assert.equal(result.body.research.available, true);
  });

  test('rejects a foreign host', async () => {
    const result = await request('GET', '/state', undefined, { host: 'evil.example:4317' });
    assert.equal(result.status, 403);
    assert.equal(result.body.ok, false);
  });

  test('honors the connection rejection status', async () => {
    const declining = createRouter({ store, origin: () => ORIGIN, authorize: () => 401, schedule: () => schedule });
    const req = Readable.from([]);
    req.method = 'GET';
    req.url = `${ROUTE}/state`;
    req.headers = { host: '127.0.0.1:4317' };
    const response = { headersSent: false, writeHead(status) { this.status = status; this.headersSent = true; }, end() {} };
    await declining(req, response);
    assert.equal(response.status, 401);
  });

  test('publishes a card over the API', async () => {
    const state = await request('GET', '/state');
    const card = state.body.cards.find(item => item.review === '待审阅');
    assert.ok(card, 'a pending card exists');
    const result = await request('POST', '/review', { id: card.id, action: 'approve' });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.review, '已入库');
    const refreshed = await request('GET', '/state');
    const noteMeta = refreshed.body.library.find(item => item.path === result.body.path);
    assert.ok(noteMeta, 'published note appears in the library list');
    const note = await request('GET', `/note?id=${encodeURIComponent(noteMeta.id)}`);
    assert.equal(note.status, 200);
    assert.match(note.body.body, /## 原理/);
  });

  test('saves preferences and adds/removes a question', async () => {
    const saved = await request('POST', '/preferences', { topics: 'A, B', level: 'L', goal: 'G', style: 'S', avoid: 'X' });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.preferences.topics, ['A', 'B']);
    const added = await request('POST', '/followup', { question: 'API 添加的问题？' });
    assert.equal(added.status, 200);
    const id = added.body.followup.id;
    const removed = await request('POST', '/followup/remove', { id });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.followups.some(item => item.id === id), false);
  });

  test('runs and schedules research through the schedule service', async () => {
    const started = await request('POST', '/research', { action: 'start' });
    assert.equal(started.status, 200);
    const create = scheduleCalls.find(call => call.kind === 'create' && call.request.target);
    assert.equal(create.request.target.kind, 'new');
    assert.equal(create.request.timing.kind, 'after');
    assert.equal(started.body.research.queued.id, 'schedule-1');
    const queued = await request('GET', '/state');
    assert.equal(queued.body.research.queued.id, 'schedule-1', 'a queued one-off run is visible in the snapshot');
    const enabled = await request('POST', '/research', { action: 'enable', time: '08:15' });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.research.time, '08:15');
    const daily = scheduleCalls.filter(call => call.kind === 'create' && call.request.timing.kind === 'daily').pop();
    assert.equal(daily.request.timing.daily.time, '08:15');
    assert.equal(daily.request.timing.daily.time_zone, 'Asia/Shanghai');
    const disabled = await request('POST', '/research', { action: 'disable' });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.research.id, null);
  });

  test('saves a custom research instruction and pushes it to the daily task', async () => {
    const saved = await request('POST', '/research', { action: 'save-prompt', prompt: '自定义步骤：先 knowledge_search 查重。' });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.research.prompt, '自定义步骤：先 knowledge_search 查重。');
    assert.match(saved.body.research.defaultPrompt, /必须查重/);
    const enabled = await request('POST', '/research', { action: 'enable', time: '09:00' });
    assert.equal(enabled.status, 200);
    const daily = scheduleCalls.filter(call => call.kind === 'create' && call.request.timing.kind === 'daily').pop();
    assert.match(daily.request.prompt, /自定义步骤/);
    const second = await request('POST', '/research', { action: 'save-prompt', prompt: '第二版指令：先读旧卡再决定。' });
    assert.equal(second.status, 200);
    const patch = scheduleCalls.filter(call => call.kind === 'edit' && call.request.patch && call.request.patch.prompt).pop();
    assert.ok(patch, 'an existing daily task receives the new instruction');
    assert.match(patch.request.patch.prompt, /第二版指令/);
    const reset = await request('POST', '/research', { action: 'save-prompt', prompt: '' });
    assert.equal(reset.body.research.prompt, '');
    assert.match(reset.body.research.defaultPrompt, /必须查重/);
    const started = await request('POST', '/research', { action: 'start' });
    assert.equal(started.status, 200);
    const nowTask = scheduleCalls.filter(call => call.kind === 'create' && call.request.timing.kind === 'after').pop();
    assert.match(nowTask.request.prompt, /必须查重/);
    const disabled = await request('POST', '/research', { action: 'disable' });
    assert.equal(disabled.body.research.id, null);
  });

  test('rejects an over-long research instruction', async () => {
    const tooLong = await request('POST', '/research', { action: 'save-prompt', prompt: 'a'.repeat(PROMPT_LIMIT + 1) });
    assert.equal(tooLong.status, 400);
    assert.match(tooLong.body.error, /过长/);
  });

  test('detects a stale built-in daily instruction and syncs only its prompt', async () => {
    await store.updateState(current => {
      current.researchScheduleId = null;
      return current;
    });
    const missing = await request('POST', '/research', { action: 'sync-prompt' });
    assert.equal(missing.status, 400);
    assert.match(missing.body.error, /没有可同步/);
    await store.updateState(current => {
      current.researchScheduleId = 'existing-daily';
      current.researchPrompt = '';
      current.researchPromptRevision = '';
      return current;
    });
    const stale = await request('GET', '/state');
    assert.equal(stale.body.research.needsPromptSync, true);
    const count = scheduleCalls.length;
    const updated = await request('POST', '/research', { action: 'sync-prompt' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.research.needsPromptSync, false);
    assert.equal(scheduleCalls.length, count + 1);
    const call = scheduleCalls.at(-1);
    assert.equal(call.request.id, 'existing-daily');
    assert.deepEqual(Object.keys(call.request.patch), ['prompt']);
    assert.equal(call.request.patch.prompt, dailyPrompt());
    assert.equal((await store.readState()).researchPromptRevision, RESEARCH_PROMPT_REVISION);
  });

  test('sync preserves custom text and a rejected update remains retryable', async () => {
    const custom = '用户自己的研究流程';
    await store.updateState(current => {
      current.researchPrompt = custom;
      current.researchPromptRevision = '';
      return current;
    });
    const state = await request('GET', '/state');
    assert.equal(state.body.research.needsPromptSync, true);
    const result = await request('POST', '/research', { action: 'sync-prompt' });
    assert.equal(result.status, 200);
    assert.equal(scheduleCalls.at(-1).request.patch.prompt, dailyPrompt(custom));
    assert.equal((await store.readState()).researchPrompt, custom);

    const originalEdit = schedule.edit;
    schedule.edit = async () => ({ code: 'not-found' });
    try {
      const rejected = await request('POST', '/research', { action: 'save-prompt', prompt: '' });
      assert.equal(rejected.status, 400);
      assert.match(rejected.body.error, /更新每日任务失败/);
      const retry = await request('GET', '/state');
      assert.equal(retry.body.research.needsPromptSync, true);
      const rejectedSync = await request('POST', '/research', { action: 'sync-prompt' });
      assert.equal(rejectedSync.status, 400);
      assert.equal((await store.readState()).researchPromptRevision, '');
    } finally {
      schedule.edit = originalEdit;
    }
    const retried = await request('POST', '/research', { action: 'sync-prompt' });
    assert.equal(retried.status, 200);
    assert.equal(retried.body.research.needsPromptSync, false);
  });

  test('rejects unknown endpoints and invalid JSON', async () => {
    const missing = await request('GET', '/nope');
    assert.equal(missing.status, 404);
    const invalid = await request('POST', '/review', { id: 'not-a-card', action: 'approve' });
    assert.equal(invalid.status, 400);
  });

  test('a queued run stops being reported once it is stale', async () => {
    await store.updateState(state => {
      state.pendingRun = { id: 'schedule-1', scheduledAt: '2020-01-01T00:00:00.000Z' };
      return state;
    });
    const state = await request('GET', '/state');
    assert.equal(state.status, 200);
    assert.equal(state.body.research.queued, null);
    await store.updateState(current => {
      current.pendingRun = null;
      return current;
    });
  });
});

