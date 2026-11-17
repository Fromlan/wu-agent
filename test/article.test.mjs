import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { normalizeArticle } from '../lib/article.js';
import { KnowledgeStore } from '../lib/store.js';
import { createToolDefinitions } from '../lib/tools.js';

// Synthetic text checks the storage contract; it is not research evidence.
function article(overrides = {}) {
  return {
    type: 'concept',
    title: '反馈延迟如何影响一次决策',
    takeaway: '反馈延迟会改变行动与结果之间的可辨识关系，其影响还取决于其他条件。',
    question: '反馈延迟改变的是哪一段判断过程？',
    definition: '这里的反馈延迟指行动发生到可观察结果出现之间的时间间隔。',
    mechanism: '时间间隔拉长时，期间可能发生其他事件，行动与结果之间的对应关系需要额外辨别。\n\n这是用于测试的假设性解释，不代表实证结论。',
    limits: '需要区分结果尚未产生和结果已经产生但尚未被观察，不能把两者混为一谈。',
    evidenceNote: '全部内容是合成测试数据；没有执行研究或实测。',
    reviewNote: '已将原先的绝对因果表述改为有条件的解释，效果大小仍未确定。',
    sources: [{
      url: 'https://example.com/feedback',
      title: 'Synthetic feedback source',
      quote: 'This is a synthetic source excerpt for storage tests only.',
      supports: '本测试使用的反馈延迟定义。',
    }],
    ...overrides,
  };
}

function comparison(overrides = {}) {
  return article({
    type: 'comparison',
    title: '反馈延迟与反馈频率分别描述什么',
    subjects: ['反馈延迟', '反馈频率'],
    definition: '反馈延迟描述等待间隔，反馈频率描述单位时间内的反馈次数。',
    comparison: [
      { dimension: '描述对象', left: '一次行动到结果的间隔', right: '一段时间内的次数', implication: '不能用次数直接替代等待时间。' },
      { dimension: '观察方式', left: '关联行动和结果', right: '统计反馈次数', implication: '两种观察可以同时进行。' },
    ],
    sources: [...article().sources, {
      url: 'https://example.com/frequency', title: 'Synthetic frequency source',
      quote: 'This is another synthetic source excerpt for storage tests.', supports: '本测试中的反馈频率定义。',
    }],
    ...overrides,
  });
}

let root;
let store;
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-articles-'));
  store = new KnowledgeStore({ vault: root, timeZone: 'Asia/Shanghai' });
  await store.ensure();
});
after(async () => { await fs.rm(root, { recursive: true, force: true }); });

test('a concept saves definitions and mechanism without tutorial fields and publishes unchanged', async () => {
  const tools = Object.fromEntries(createToolDefinitions(store).map(tool => [tool.name, tool]));
  const created = await tools.knowledge_capture.execute(article());
  const card = await store.getCandidate(created.id);
  assert.equal(card.meta.card_type, 'concept');
  assert.equal(card.meta.question, article().question);
  for (const heading of ['研究问题', '概念定义', '机制解释', '边界与取舍', '证据与不确定性', '审读记录', '来源']) {
    assert.ok(card.body.includes(`## ${heading}`));
  }
  assert.doesNotMatch(card.body, /## (场景|做法|怎么验证|概念比较)/);
  assert.match(card.body, /作者自检，不代表独立核验/);
  assert.ok(card.body.includes(article().mechanism));
  const matches = await tools.knowledge_search.execute({ query: '反馈延迟', scope: 'inbox' });
  assert.ok(matches.matches.some(item => item.id === created.id));
  const read = await tools.knowledge_read.execute({ id: created.id });
  assert.equal(read.body, card.body);
  await assert.rejects(() => tools.knowledge_capture.execute(article()), /收件箱已有/);
  await store.reviewCard(created.id, 'approve');
  const published = (await store.listLibrary()).find(item => item.path.endsWith(`${created.id}.md`));
  const note = await store.getLibraryNote(published.id);
  assert.ok(note.body.includes(article().mechanism));
  assert.doesNotMatch(note.body, /把顶部 review 改成/);
  const raw = await fs.readFile(path.join(root, published.path), 'utf8');
  assert.match(raw, /card_type: "concept"/);
  assert.match(raw, /source_count: 1/);
  await assert.rejects(() => store.createCard(article()), /知识库已有/);
});

test('comparison renders aligned dimensions, source mapping and table-safe cells', async () => {
  const input = comparison();
  input.comparison[0].left = '间隔 | 条件\n下一句';
  const created = await store.createCard(input);
  const card = await store.getCandidate(created.id);
  assert.equal(card.meta.card_type, 'comparison');
  assert.equal(card.meta.source_count, '2');
  assert.match(card.body, /\| 共同维度 \| 反馈延迟 \| 反馈频率 \| 差异的影响 \|/);
  assert.ok(card.body.includes('间隔 \\| 条件 / 下一句'));
  assert.ok(card.body.includes('支撑「本测试中的反馈频率定义。」'));
  // Human approval through Obsidian must preserve the typed article too.
  const file = path.join(store.inbox, `${created.id}.md`);
  const raw = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, raw.replace('review: "待审阅"', 'review: 确认'), 'utf8');
  assert.equal(await store.scanApprovals(), 1);
  assert.ok((await fs.readFile(path.join(root, 'library', `${created.id}.md`), 'utf8')).includes('card_type: "comparison"'));
});

test('typed articles reject missing explanations, uncertainty and editorial notes', () => {
  for (const key of ['question', 'definition', 'mechanism', 'limits', 'evidenceNote', 'reviewNote']) {
    assert.throws(() => normalizeArticle(article({ [key]: '' })), /缺少/);
  }
  assert.equal(normalizeArticle({ title: '旧卡', scene: '旧场景' }), null);
  assert.throws(() => normalizeArticle(article({ type: undefined })), /卡片类型/);
  assert.throws(() => normalizeArticle({ question: '新结构不能绕过类型校验' }), /卡片类型/);
  assert.throws(() => normalizeArticle(article({ subjects: ['A', 'B'] })), /仅用于/);
});

test('comparison requires two different subjects, shared distinct dimensions and both sides', () => {
  assert.throws(() => normalizeArticle(comparison({ subjects: ['A'] })), /两个比较对象/);
  assert.throws(() => normalizeArticle(comparison({ subjects: ['Ａ', 'a'] })), /不能相同/);
  assert.throws(() => normalizeArticle(comparison({ comparison: [] })), /共同维度/);
  assert.throws(() => normalizeArticle(comparison({ comparison: Array(7).fill(comparison().comparison[0]) })), /共同维度/);
  assert.throws(() => normalizeArticle(comparison({ comparison: [comparison().comparison[0], comparison().comparison[0]] })), /维度不能重复/);
  const rows = comparison().comparison;
  rows[0].right = '';
  assert.throws(() => normalizeArticle(comparison({ comparison: rows })), /右侧概念解释/);
  assert.throws(() => normalizeArticle(comparison({ sources: article().sources })), /至少需要两条/);
});

test('evidence requires real URL syntax, page title and a concrete support mapping', () => {
  const source = article().sources[0];
  for (const [change, error] of [
    [{ supports: '' }, /支撑的具体论断/], [{ title: '' }, /来源标题/],
    [{ quote: 'short' }, /引文太短/], [{ quote: '引'.repeat(601) }, /过长/],
    [{ url: 'https://' }, /http/], [{ url: 'file:///private' }, /http/],
    [{ url: 'https://user:password@example.com/' }, /http/],
  ]) assert.throws(() => normalizeArticle(article({ sources: [{ ...source, ...change }] })), error);
  assert.throws(() => normalizeArticle(article({ sources: [] })), /原文来源/);
  assert.throws(() => normalizeArticle(comparison({ sources: [source, { ...source, url: `${source.url}#different-fragment` }] })), /来源链接重复/);
});

test('oversized explanations are rejected without truncating the saved text', async () => {
  await assert.rejects(() => store.createCard(article({ title: '过长解释', mechanism: '甲'.repeat(4001) })), /机制解释.*过长/);
  const mechanism = '甲'.repeat(3990) + '末尾结论仍然存在';
  const created = await store.createCard(article({ title: '完整保留长解释', mechanism }));
  const read = await store.getCandidate(created.id);
  assert.ok(read.body.includes(mechanism));
});

test('a failed article leaves no candidate behind', async () => {
  const before = await fs.readdir(store.inbox);
  await assert.rejects(() => store.createCard(comparison({ title: '不会保存', sources: [] })), /原文来源/);
  assert.deepEqual(await fs.readdir(store.inbox), before);
});

test('combined comparison and evidence must fit the full-note reading limit', async () => {
  const input = comparison({
    title: '过长的比较与证据',
    definition: '定'.repeat(2400), mechanism: '理'.repeat(4000), limits: '界'.repeat(1800),
    evidenceNote: '据'.repeat(1200), reviewNote: '审'.repeat(800), related: '联'.repeat(800),
    comparison: Array.from({ length: 6 }, (_, index) => ({
      dimension: `维度${index}`, left: '左'.repeat(500), right: '右'.repeat(500), implication: '影'.repeat(500),
    })),
    sources: Array.from({ length: 5 }, (_, index) => ({
      url: `https://example.com/source-${index}`, title: '原'.repeat(200),
      quote: '引'.repeat(600), supports: '论'.repeat(300),
    })),
  });
  // Each field passes its own limit, but the combined article must remain readable in full.
  assert.ok(normalizeArticle(input));
  const before = await fs.readdir(store.inbox);
  await assert.rejects(() => store.createCard(input), /正文过长/);
  assert.deepEqual(await fs.readdir(store.inbox), before);
});

test('a full article stays within the agent read limit, including evidence', async () => {
  const input = comparison({
    title: '完整读取长篇比较和来源',
    definition: '定'.repeat(2000), mechanism: '机'.repeat(3900),
    limits: '界'.repeat(1700), evidenceNote: '证'.repeat(1100), reviewNote: '审'.repeat(700),
    comparison: Array.from({ length: 6 }, (_, index) => ({
      dimension: `维度${index}`, left: '左'.repeat(400), right: '右'.repeat(400), implication: '影'.repeat(400),
    })),
  });
  const created = await store.createCard(input);
  const card = await store.getCandidate(created.id);
  assert.ok(card.body.length > 12000);
  assert.ok(card.body.length <= 24000);
  const readTool = createToolDefinitions(store).find(tool => tool.name === 'knowledge_read');
  assert.equal((await readTool.execute({ id: created.id })).body, card.body);
});
