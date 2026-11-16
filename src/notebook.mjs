import path from 'node:path';
import { markdownFiles, parseNote, readText } from './files.mjs';

export const reviewHelp = '阅读后，将顶部 review 改为「确认」即可入库，也可以选择「暂缓」或「跳过」。';

function describe(raw) {
  let note;
  try { note = parseNote(raw); } catch { note = { fields: {}, body: raw }; }
  const body = note.body.replace(/\r\n/g, '\n').replace(`\n---\n\n${reviewHelp}`, '').trim();
  const title = note.fields.title || body.match(/^#\s+(.+)$/m)?.[1];
  const excerpt = body.match(/^##\s+核心结论\s*\n+([^\n]+)/m)?.[1]
    || body.split('\n').find(line => line.trim() && !/^\s*[#>-]|^\s*!?\[/.test(line));
  return { fields: note.fields, body, title, excerpt: (excerpt || '').slice(0, 200) };
}

export async function candidate(agent, card, details = false) {
  const file = `每日审阅/候选卡片/${card.id}.md`;
  const raw = await readText(agent.vaultPath(file));
  const note = describe(raw);
  const receipt = await agent.receipt(card.id);
  let review = '属性待检查';
  if (receipt) review = '已入库';
  else if (note.fields.id === card.id && note.fields.version === '1') {
    review = { 确认: '等待入库', 待审阅: '待审阅', 暂缓: '暂缓', 跳过: '跳过' }[note.fields.review] || review;
  }
  return { ...card, title: note.title || card.title, excerpt: note.excerpt, review, available: Boolean(raw),
    uri: agent.obsidianUri(file), publishedUri: receipt ? agent.obsidianUri(`知识库/${card.id}.md`) : null,
    ...(details ? { content: raw, body: note.body } : {}) };
}

export async function library(agent, { query = '', id } = {}) {
  const directory = agent.vaultPath('知识库');
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const cards = [];
  for (const file of await markdownFiles(directory)) {
    const relative = path.relative(directory, file).split(path.sep).join('/');
    const key = Buffer.from(relative).toString('base64url');
    if (id && key !== id) continue;
    const raw = await readText(file);
    if (!raw) continue;
    const note = describe(raw);
    const title = note.title || path.basename(file, '.md');
    if (terms.length && !terms.every(term => `${title}\n${raw}`.toLowerCase().includes(term))) continue;
    const card = { id: key, title, excerpt: note.excerpt, date: note.fields.created || '', review: '已入库', uri: agent.obsidianUri(`知识库/${relative}`) };
    if (id) return { ...card, body: note.body };
    cards.push(card);
  }
  return id ? null : cards.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'));
}
