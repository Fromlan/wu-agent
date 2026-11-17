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
    claim: '当单次查询延迟可接受时，把 N 次往返合并为一次批处理能显著降低总延迟。',
    explanation: '批处理把固定开销摊薄到多条数据上，适合离线或可接受的秒级延迟场景。',
    limits: '不适用于强实时或单条失败必须独立重试的链路。',
    sources: [{
      url: 'https://example.com/batch',
      title: 'Batching guide',
      quote: 'Batching trades per-request overhead for a larger payload and a single round trip.',
    }],
    tags: ['性能', '架构'],
    ...overrides,
  };
}

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
    assert.match(raw, /summary: "/);
    assert.match(raw, /source_count: 1/);
    assert.match(raw, /sources: \["https:\/\/example\.com\/batch"\]/);
    assert.match(raw, /## 核心结论/);
    assert.match(raw, /Batching trades per-request overhead/);
    const body = await store.getCandidate(created.id);
    assert.equal(body.title, cardInput().title);
    assert.equal(body.tags.length, 2);
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
  });

  test('capture, search, read, ask, and brief execute end to end', async () => {
    const tools = Object.fromEntries(createToolDefinitions(store).map(tool => [tool.name, tool]));
    const created = await tools.knowledge_capture.execute(cardInput({ title: '工具链路验证卡' }), {});
    assert.match(created.id, /^kb-/);
    assert.equal(created.review, '待审阅');
    const found = await tools.knowledge_search.execute({ query: '工具链路', scope: 'inbox', limit: 5 }, {});
    assert.ok(found.matches.some(match => match.id === created.id));
    const read = await tools.knowledge_read.execute({ id: created.id }, {});
    assert.match(read.body, /核心结论/);
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
    assert.match(note.body.body, /核心结论/);
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

