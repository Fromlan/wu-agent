import path from 'node:path';
import { loadConfig } from '../src/config.mjs';
import { Agent } from '../src/agent.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { readJson, readText, writeFile, parseNote, renderNote } from '../src/files.mjs';

const config = loadConfig();
const directory = path.join(config.stateDir, `live-smoke-${Date.now()}`);
config.stateDir = path.join(directory, 'state');
config.vault = path.join(directory, 'vault');
config.queryLimit = 1;
config.sourceLimit = 1;
config.cardLimit = 1;
const agent = new Agent(config, new DeepSeek(config));

try {
  await agent.init();
  await agent.enqueue('chat-live-smoke', 'chat', {
    text: '这是一轮测试。我想了解 Obsidian 知识笔记的双向链接，有编程基础，喜欢简单的实际例子。',
  });
  await agent.workOne();
  const chat = await readJson(agent.statePath('events', 'chat-live-smoke.json'));
  if (chat.status !== 'done') throw new Error(chat.error);
  const snapshot = await agent.snapshot();
  console.log('真实对话完成。主动追问：', snapshot.turns[0].question);
  const research = await agent.requestResearch();
  for (let step = 0; step < 10; step++) {
    await agent.workOne();
    const event = await readJson(agent.statePath('events', `${research.id}.json`));
    console.log('研究状态：', event.step, event.status);
    if (event.error) throw new Error(event.error);
    if (event.status === 'done') break;
  }
  const cards = (await agent.snapshot()).cards;
  if (!cards.length) throw new Error('此次真实研究没有形成可验证的卡片');
  const card = cards[0];
  const file = agent.vaultPath('每日审阅', '候选卡片', `${card.id}.md`);
  const note = parseNote(await readText(file));
  note.fields.review = '确认';
  await writeFile(file, renderNote(note.fields, note.body));
  await agent.scanApprovals();
  await agent.workOne();
  const published = await readText(agent.vaultPath('知识库', `${card.id}.md`));
  if (!published) throw new Error('测试目录内的确认发布失败');
  console.log('真实调用及测试目录内的确认发布通过。卡片：', card.title);
  console.log('测试结果：', directory);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await agent.close(); }
