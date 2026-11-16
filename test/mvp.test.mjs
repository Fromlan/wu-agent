import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { projectRoot, localClock } from '../src/config.mjs';
import { Agent } from '../src/agent.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { startServer } from '../src/server.mjs';
import { readJson, readText, writeFile, writeJson, listJson, parseNote, renderNote } from '../src/files.mjs';

const sourceUrl = 'https://example.org/agent-memory';
const sourceText = 'Agent memory should record the source and the date of each fact. A record can be superseded when the user supplies a correction. This enables traceable updates and repeatable retrieval tests.';

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wu-agent-test-'));
  const calls = [];
  let mode = 'normal';
  const mock = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls.push({ endpoint: request.url, body });
    response.setHeader('Content-Type', 'application/json');
    if (mode === 'error') { response.end(JSON.stringify({ error: { message: 'simulated failure' } })); return; }
    if (request.url.endsWith('/search')) {
      response.end(JSON.stringify({ results: [{ url: sourceUrl, title: 'Agent memory', authority: 4, rerank_score: 2.5 }] })); return;
    }
    if (request.url.endsWith('/fetch')) {
      response.end(JSON.stringify({ title: 'Agent memory', content: sourceText })); return;
    }
    let data;
    if (body.system.includes('个人知识研究助手')) {
      const prompt = JSON.parse(body.messages[0].content);
      data = {
        reply: '会围绕长期记忆查找可复现的实现。', question: '你想先看文件存储还是检索方法？',
        preferences: [{ key: 'topics', value: ['Agent 长期记忆'], evidence: prompt.message }, { key: 'style', value: '实践案例', evidence: '用户未说过的内容' }],
      };
    } else if (body.system.includes('规划今天')) {
      data = { focus: '长期记忆如何记录事实变更', queries: ['agent memory fact provenance'], reason: '推进你的 Agent 实现' };
    } else {
      data = {
        cards: [{ title: '记录事实的来源与日期', claim: '每条事实保存来源和日期，便于后续更正。', explanation: '在 Markdown 属性中记录来源和有效日期。', limits: '引用记录仍需要核对事实是否适用。', evidence: [{ url: sourceUrl, quote: 'Agent memory should record the source and the date of each fact.' }] }],
        nextQuestions: ['如何处理过时记忆？'], question: '明天想看检索实现吗？',
      };
    }
    response.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(data) }], stop_reason: 'end_turn', usage: { input_tokens: 30, output_tokens: 50 } }));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const config = {
    root: projectRoot, stateDir: path.join(directory, 'state'), vault: path.join(directory, 'vault'),
    key: 'test-fixture-key', model: 'deepseek-flash', apiBase: `http://127.0.0.1:${mock.address().port}`,
    port: 0, dailyAt: '23:59', timezone: 'Asia/Shanghai', cardLimit: 3, queryLimit: 3, sourceLimit: 4,
  };
  const agent = new Agent(config, new DeepSeek(config));
  await agent.init();
  return { directory, config, agent, calls, setMode(value) { mode = value; }, async close() {
    await agent.close();
    await new Promise(resolve => mock.close(resolve));
    assert.ok(directory.startsWith(path.join(os.tmpdir(), 'wu-agent-test-')));
    await fs.rm(directory, { recursive: true, force: true });
  } };
}

async function research(fixture) {
  await fixture.agent.enqueue('chat-first', 'chat', { text: '我想学习 Agent 长期记忆。' });
  await fixture.agent.workOne();
  const event = await fixture.agent.requestResearch();
  await finishResearch(fixture.agent, event);
  return event;
}

async function finishResearch(agent, event) {
  for (let step = 0; step < 8; step++) {
    await agent.workOne();
    const saved = await readJson(agent.statePath('events', `${event.id}.json`));
    if (saved.status === 'done') return;
    assert.notEqual(saved.status, 'failed', saved.error);
  }
  assert.fail('研究未结束');
}

test('DeepSeek 协议 → 主动追问 → 每日卡片 → Obsidian 确认 → 幂等入库', async () => {
  const f = await fixture();
  try {
    assert.match((await f.agent.snapshot()).outbox[0].text, /最想弄懂/);
    const event = await research(f);
    const state = await f.agent.snapshot();
    assert.match(state.turns[0].question, /文件存储/);
    assert.equal(state.profile.preferences.style, undefined, '模型虚构的偏好依据应被丢弃');
    assert.equal(state.cards.length, 1);
    assert.deepEqual(await fs.readdir(f.agent.vaultPath('知识库')), []);
    const card = state.cards[0];
    const file = f.agent.vaultPath('每日审阅', '候选卡片', `${card.id}.md`);
    const note = parseNote(await readText(file));
    note.fields.review = '确认';
    note.body += '\n用户补充的适用说明。\n';
    const edited = renderNote(note.fields, note.body).replace('version: "1"', 'version: "1"\ntags:\n  - user-added');
    await writeFile(file, edited.replace(/\n/g, '\r\n'));
    await f.agent.scanApprovals();
    await f.agent.workOne();
    const published = await readText(f.agent.vaultPath('知识库', `${card.id}.md`));
    assert.match(published, /用户补充的适用说明/);
    assert.match(published, /已入库/);
    assert.match(published, /approved_hash:/);
    assert.match(published, /tags:\r\n  - user-added/);
    assert.match(published, /https:\/\/example.org/);
    await f.agent.scanApprovals(); await f.agent.workOne();
    assert.equal((await fs.readdir(f.agent.vaultPath('知识库'))).length, 1);
    await f.agent.setPreferences({ dailyAt: '00:00' });
    await f.agent.schedule(new Date(event.createdAt));
    const researchEvents = (await f.agent.snapshot()).events.filter(item => item.type === 'research');
    assert.deepEqual(researchEvents.map(item => [item.id, item.status]), [[event.id, 'done']]);
    assert.equal(f.calls.filter(call => call.endpoint.endsWith('/search')).length, 1);
    assert.equal(f.calls.filter(call => call.endpoint.endsWith('/fetch')).length, 1);
    assert.ok(f.calls.filter(call => call.endpoint.endsWith('/messages')).every(call => call.body.model === 'deepseek-flash'));
  } finally { await f.close(); }
});

test('重启恢复研究检查点，同时优先处理新用户消息', async () => {
  const f = await fixture();
  try {
    await f.agent.enqueue('chat-initial', 'chat', { text: '研究 Agent 记忆' });
    await f.agent.workOne();
    const event = await f.agent.requestResearch();
    await f.agent.workOne(); // Plan persisted.
    await f.agent.workOne(); // Search persisted.
    const interrupted = await readJson(f.agent.statePath('events', `${event.id}.json`));
    interrupted.status = 'running';
    await f.agent.saveEvent(interrupted);
    const restarted = new Agent(f.config, new DeepSeek(f.config));
    await restarted.init();
    await restarted.enqueue('chat-followup', 'chat', { text: '我更想了解检索' });
    await restarted.workOne();
    assert.equal((await readJson(restarted.statePath('events', 'chat-followup.json'))).status, 'done');
    for (let i = 0; i < 4; i++) await restarted.workOne();
    assert.equal((await readJson(restarted.statePath('events', `${event.id}.json`))).status, 'done');
    assert.equal(f.calls.filter(call => call.endpoint.endsWith('/search')).length, 1);
    await restarted.close();
  } finally { await f.close(); }
});

test('确认快照过时、已发布后修改、重启时发布半完成', async () => {
  const f = await fixture();
  try {
    await research(f);
    const card = (await f.agent.snapshot()).cards[0];
    const draftFile = f.agent.vaultPath('每日审阅', '候选卡片', `${card.id}.md`);
    const draft = parseNote(await readText(draftFile));
    draft.fields.review = '确认';
    await writeFile(draftFile, renderNote(draft.fields, draft.body));
    await f.agent.scanApprovals();
    draft.body += '\n刚编辑的新内容\n';
    await writeFile(draftFile, renderNote(draft.fields, draft.body));
    await f.agent.workOne();
    assert.equal((await fs.readdir(f.agent.vaultPath('知识库'))).length, 0);
    await f.agent.scanApprovals(); await f.agent.workOne();
    const finalFile = f.agent.vaultPath('知识库', `${card.id}.md`);
    const published = await readText(finalFile);
    assert.match(published, /刚编辑/);
    const receiptFile = f.agent.statePath('receipts', `${card.id}.json`);
    await fs.unlink(receiptFile); // Simulate crash after publishing but before receipt.
    const events = await listJson(f.agent.statePath('events'));
    const approval = events.find(event => event.type === 'approval' && event.status === 'done');
    approval.status = 'running'; await f.agent.saveEvent(approval);
    await f.agent.init(); await f.agent.workOne();
    assert.ok(await readJson(receiptFile));
    draft.body += '\n发布之后再次编辑\n';
    await writeFile(draftFile, renderNote(draft.fields, draft.body));
    await f.agent.scanApprovals(); await f.agent.workOne();
    assert.equal(await readText(finalFile), published);
    assert.ok((await f.agent.snapshot()).events.some(event => /已入库/.test(event.error || '')));
  } finally { await f.close(); }
});

test('时区调度去重、证据校验和缺失 Key 的失败状态', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(localClock(new Date('2026-11-16T01:01:00Z'), 'Asia/Shanghai'), { date: '2026-11-16', time: '09:01' });
    const profile = { preferences: { topics: { value: ['长期记忆'] } }, history: [] };
    await writeJson(f.agent.statePath('profile.json'), profile);
    f.config.dailyAt = '09:00';
    await f.agent.schedule(new Date('2026-11-16T01:01:00Z'));
    await f.agent.schedule(new Date('2026-11-16T03:01:00Z'));
    assert.equal((await listJson(f.agent.statePath('events'))).length, 1);
    assert.throws(() => f.agent.validateCards([{ title: '错引', claim: 'A', explanation: 'B', limits: 'C', evidence: [{ url: sourceUrl, quote: 'invented quote' }] }], [{ url: sourceUrl, content: sourceText }]), /原文证据/);
    f.config.key = '';
    await f.agent.workOne();
    const event = (await listJson(f.agent.statePath('events')))[0];
    assert.equal(event.status, 'failed');
    assert.match(event.error, /DEEPSEEK_API_KEY/);
    assert.equal(f.calls.length, 0);
  } finally { await f.close(); }
});

test('自动研究暂停时仍可手动研究，同日第二轮另存简报且重复触发只排一次', async () => {
  const f = await fixture();
  try {
    await f.agent.setPreferences({ preferences: { topics: ['可追溯知识库'] }, paused: true });
    const first = await f.agent.requestResearch();
    await finishResearch(f.agent, first);
    await f.agent.queueQuestion('如何核对来源和日期？', undefined, 'second-round');
    const [second, duplicate] = await Promise.all([f.agent.requestResearch(), f.agent.requestResearch()]);
    assert.notEqual(second.id, first.id);
    assert.equal(duplicate.id, second.id);
    await finishResearch(f.agent, second);
    await f.agent.setPreferences({ paused: false, dailyAt: '00:00' });
    await f.agent.schedule();

    const { cards, events, runs } = await f.agent.snapshot();
    assert.equal(events.filter(event => event.type === 'research').length, 2);
    assert.deepEqual(runs.map(run => run.id), [second.id, first.id]);
    assert.equal(runs[0].focus, '如何核对来源和日期？');
    assert.equal((await f.agent.followups()).length, 0);
    for (const run of runs) {
      const file = new URL(run.uri).searchParams.get('path');
      const card = cards.find(card => card.runId === run.id);
      assert.ok((await readText(file)).includes(card.id));
    }
    assert.notEqual(runs[0].uri, runs[1].uri);
  } finally { await f.close(); }
});

test('删除候选可跨重启完成，已排队的确认和重跑交付都不会恢复它', async () => {
  const f = await fixture();
  try {
    const event = await research(f);
    const [card] = (await f.agent.snapshot()).cards;
    const draft = f.agent.vaultPath('每日审阅', '候选卡片', `${card.id}.md`);
    const raw = (await readText(draft)).replace('review: "待审阅"', 'review: "确认"');
    await writeFile(draft, raw);
    await f.agent.scanApprovals();
    assert.ok((await f.agent.snapshot()).events.some(event => event.type === 'approval' && event.status === 'pending'));

    const record = f.agent.statePath('cards', `${card.id}.json`);
    await writeJson(record, { ...(await readJson(record)), deletedAt: new Date().toISOString(), trashPending: true });
    await f.agent.init();
    await f.agent.workOne();
    const runFile = f.agent.statePath('runs', `${event.id}.json`);
    await writeJson(runFile, { ...(await readJson(runFile)), stage: 'deliver' });
    await f.agent.research(event);

    assert.equal(await readText(draft), '');
    assert.equal(await readText(f.agent.vaultPath('.trash', 'wu-agent', `${card.id}.md`)), raw);
    assert.equal(await readText(f.agent.vaultPath('知识库', `${card.id}.md`)), '');
    assert.deepEqual((await f.agent.snapshot()).cards, []);
  } finally { await f.close(); }
});

test('真实 HTTP 入口、重复发送、CSRF 和进程互斥', async () => {
  const f = await fixture();
  let service;
  try {
    f.config.root = path.join(f.directory, 'release');
    await fs.cp(path.join(projectRoot, 'public'), path.join(f.config.root, 'public'), { recursive: true });
    service = await startServer(f.config);
    const state = await (await fetch(`${service.url}/api/state`)).json();
    assert.ok(state.csrf);
    assert.equal(state.key, undefined);
    const headers = { 'Content-Type': 'application/json', 'X-Wu-Token': state.csrf };
    const payload = { text: '想了解长期记忆', requestId: 'same-request' };
    const [first, second] = await Promise.all([fetch(`${service.url}/api/chat`, { method: 'POST', headers, body: JSON.stringify(payload) }), fetch(`${service.url}/api/chat`, { method: 'POST', headers, body: JSON.stringify(payload) })]);
    assert.equal(first.status, 202); assert.equal(second.status, 202);
    assert.equal((await listJson(f.agent.statePath('events'))).filter(event => event.type === 'chat').length, 1);
    assert.equal((await fetch(`${service.url}/api/research`, { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status, 403);
    assert.equal((await fetch(`${service.url}/api/research`, { method: 'POST' })).status, 403);
    const home = await fetch(`${service.url}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /href="\/favicon\.ico"/);
    const icon = await fetch(`${service.url}/favicon.ico`);
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get('content-type'), 'image/x-icon');
    const onDiskModule = path.join(f.config.root, 'public', 'ui.js');
    const originalModule = await readText(onDiskModule);
    await writeFile(onDiskModule, '// replacement for the next service restart');
    const ui = await fetch(`${service.url}/ui.js`);
    assert.equal(ui.status, 200);
    assert.equal(await ui.text(), originalModule.replace(/^\uFEFF/, ''));
    await assert.rejects(startServer(f.config), /已有服务/);
  } finally { if (service) await service.close(); await f.close(); }
});

test('HTTP 200 的服务端错误也会触发失败处理', async () => {
  const f = await fixture();
  try {
    f.setMode('error');
    await assert.rejects(f.agent.api.search('memory'), /生成错误/);
  } finally { await f.close(); }
});

test('工作台偏好和追问跨重启保留，待研究问题进入下一次规划并在交付后出队', async () => {
  const f = await fixture();
  try {
    const question = '如何验证上一轮研究的引文没有被改写？';
    await f.agent.setPreferences({ preferences: { topics: ['可追溯知识库'], style: '以实践案例为主', avoid: '入门工具清单' }, dailyAt: '08:15', paused: true });
    const queued = await f.agent.queueQuestion(question, undefined, 'initial');
    assert.equal((await f.agent.queueQuestion(question, undefined, 'double-click')).id, queued.id);
    const extra = await f.agent.queueQuestion('暂时不想研究的问题', undefined, 'removed');
    await f.agent.removeQuestion(extra.id);
    const agent = new Agent(f.config, new DeepSeek(f.config));
    await agent.init();
    try {
      assert.equal((await agent.snapshot()).dailyAt, '08:15');
      assert.deepEqual((await agent.followups()).map(item => item.question), [question]);
      await agent.schedule(new Date('2026-11-16T01:00:00Z'));
      assert.equal((await agent.snapshot()).events.length, 0, '暂停时不自动消耗研究额度');
      const event = await agent.requestResearch();
      await agent.workOne();
      assert.equal((await agent.followups()).length, 1, '未交付时保留追问');
      const planner = f.calls.find(call => call.body.system?.includes('规划今天'));
      const prompt = JSON.parse(planner.body.messages[0].content);
      assert.equal(prompt.priorityQuestion, question);
      assert.equal(prompt.preferences.avoid, '入门工具清单');
      for (let i = 0; i < 5; i++) await agent.workOne();
      assert.equal((await agent.snapshot()).runs[0].focus, question);
      assert.equal((await agent.snapshot()).events.find(item => item.id === event.id).status, 'done');
      assert.equal((await agent.followups()).length, 0);
    } finally { await agent.close(); }
  } finally { await f.close(); }
});

test('工作台区分候选和正式笔记，检索正式正文并把原追问传给对话', async () => {
  const f = await fixture();
  let service;
  try {
    const run = await research(f);
    const [card] = (await f.agent.snapshot()).cards;
    service = await startServer(f.config);
    const get = async endpoint => (await fetch(service.url + endpoint)).json();
    const state = await get('/api/state');
    const post = (endpoint, body) => fetch(service.url + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Wu-Token': state.csrf }, body: JSON.stringify(body) });
    assert.equal((await get('/api/library')).cards.length, 0);
    const draft = await get(`/api/cards/${card.id}`);
    assert.match(draft.excerpt, /便于后续更正/);
    assert.match(draft.body, /https:\/\/example.org/);
    assert.doesNotMatch(draft.body, /^---/);
    assert.equal((await post('/api/preferences', { dailyAt: '24:00' })).status, 400);
    const reply = await post('/api/chat', { text: '我想看检索实现。', requestId: 'reply-to-daily', replyTo: run.id });
    assert.equal(reply.status, 202);
    const { id } = await reply.json();
    assert.deepEqual((await readJson(service.agent.statePath('events', `${id}.json`))).payload.respondingTo, { id: run.id, question: '明天想看检索实现吗？' });
    const file = service.agent.vaultPath('每日审阅', '候选卡片', `${card.id}.md`);
    await writeFile(file, (await readText(file)).replace('review: "待审阅"', 'review: "确认"'));
    await service.agent.workPromise;
    await service.agent.scanApprovals();
    await service.agent.workOne();
    const { cards } = await get('/api/library?q=' + encodeURIComponent('适用'));
    assert.equal(cards.length, 1, '按正文中的中文短词可查到正式卡片');
    assert.equal((await get(`/api/library/${cards[0].id}`)).review, '已入库');
    assert.equal((await get(`/api/cards/${card.id}`)).review, '已入库');

    const deletePath = `/api/cards/${card.id}/delete`;
    assert.equal((await fetch(service.url + deletePath, { method: 'POST' })).status, 403);
    const raw = await readText(file);
    assert.deepEqual(await (await post(deletePath, {})).json(), { deleted: true });
    assert.equal((await post(deletePath, {})).status, 200);
    assert.equal((await fetch(`${service.url}/api/cards/${card.id}`)).status, 404);
    assert.deepEqual((await get('/api/state')).cards, []);
    assert.equal(await readText(file), '');
    assert.equal(await readText(service.agent.vaultPath('.trash', 'wu-agent', `${card.id}.md`)), raw);
    assert.equal((await get(`/api/library/${cards[0].id}`)).review, '已入库');
  } finally { if (service) await service.close(); await f.close(); }
});
