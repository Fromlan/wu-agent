import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { readJson, acquireLock } from './files.mjs';
import { DeepSeek } from './deepseek.mjs';
import { Agent } from './agent.mjs';
import { candidate, library } from './notebook.mjs';
import { chatApiPrefix, createChatProxy, loadChatDemo } from './chat-demo.mjs';

const requestIdPattern = /^[a-zA-Z0-9-]{1,64}$/;
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const staticFiles = [
  ['/', 'index.html', 'text/html; charset=utf-8'],
  ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ['/ui.js', 'ui.js', 'text/javascript; charset=utf-8'],
  ['/style.css', 'style.css', 'text/css; charset=utf-8'],
  ['/favicon.ico', 'favicon.ico', 'image/x-icon'],
];

export async function startServer(config, api = new DeepSeek(config)) {
  // Load the frontend once so edits on disk cannot mix a new page with an older server.
  const assets = new Map(await Promise.all(staticFiles.map(async ([url, file, type]) => {
    const content = await readFile(path.join(config.root, 'public', file));
    return [url, { type, content }];
  })));
  const serveChatDemo = await loadChatDemo(config.root, Boolean(config.key));
  const release = await acquireLock(config.stateDir);
  const agent = new Agent(config, api);
  const chatProxy = createChatProxy(config, agent);
  const csrf = randomBytes(24).toString('hex');
  let timer;
  const server = http.createServer(async (request, response) => {
    const json = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(data));
    };
    try {
      const port = server.address().port;
      const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!allowed.includes(request.headers.host)) return json(403, { error: '只允许本机访问' });
      if (request.headers.origin && !allowed.some(host => request.headers.origin === `http://${host}`)) return json(403, { error: '请求来源无效' });
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname.startsWith(chatApiPrefix + '/')) {
        await chatProxy.handle(request, response, url.pathname.slice(chatApiPrefix.length));
        return;
      }
      if (serveChatDemo(request, response, url.pathname)) return;
      if (request.method === 'GET' && url.pathname === '/api/state') return json(200, { ...(await agent.snapshot()), csrf });
      const cardMatch = url.pathname.match(/^\/api\/cards\/([a-zA-Z0-9_-]{1,100})$/);
      if (request.method === 'GET' && cardMatch) {
        const card = await readJson(agent.statePath('cards', `${cardMatch[1]}.json`));
        const note = card && !card.deletedAt && await candidate(agent, card, true);
        return note?.available ? json(200, note) : json(404, { error: '找不到候选笔记，请检查 Vault' });
      }
      if (request.method === 'GET' && url.pathname === '/api/library') {
        return json(200, { cards: await library(agent, { query: (url.searchParams.get('q') || '').slice(0, 120) }) });
      }
      const noteMatch = url.pathname.match(/^\/api\/library\/([a-zA-Z0-9_-]{1,2048})$/);
      if (request.method === 'GET' && noteMatch) {
        const note = await library(agent, { id: noteMatch[1] });
        return note ? json(200, note) : json(404, { error: '这篇笔记已被移动或删除，请刷新知识库' });
      }
      if (request.method === 'POST') {
        if (request.headers['x-wu-token'] !== csrf) return json(403, { error: '请刷新页面后重试' });
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 65_536) return json(413, { error: '消息太长，请分段发送' });
          chunks.push(chunk);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
        catch { return json(400, { error: '请求 JSON 格式有误' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: '请求格式有误' });
        if (url.pathname === '/api/chat') {
          if (!config.key) return json(400, { error: '请先配置 DeepSeek API Key' });
          if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 6000) return json(400, { error: '请输入 1–6000 字的消息' });
          const clientId = body.requestId || randomUUID();
          if (typeof clientId !== 'string' || !requestIdPattern.test(clientId)) return json(400, { error: '请求 ID 无效' });
          let respondingTo;
          if (body.replyTo !== undefined) {
            if (typeof body.replyTo !== 'string' || !idPattern.test(body.replyTo)) return json(400, { error: '追问 ID 无效' });
            const question = await readJson(agent.statePath('outbox', `${body.replyTo}.json`));
            if (!question?.question) return json(404, { error: '找不到这条追问' });
            respondingTo = { id: question.id, question: question.question };
          }
          const event = await agent.enqueue(`chat-${clientId}`, 'chat', { text: body.text.trim(), respondingTo });
          void agent.tick();
          return json(202, { id: event.id });
        }
        if (url.pathname === '/api/research') {
          const event = await agent.requestResearch();
          void agent.tick();
          return json(202, { id: event.id, status: event.status });
        }
        const deleteCardMatch = url.pathname.match(/^\/api\/cards\/([a-zA-Z0-9_-]{1,100})\/delete$/);
        if (deleteCardMatch) {
          await agent.deleteCandidate(deleteCardMatch[1]);
          return json(200, { deleted: true });
        }
        if (url.pathname === '/api/preferences') {
          const { preferences = {}, dailyAt, paused } = body;
          if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)
            || Object.entries(preferences).some(([key, value]) => key === 'topics'
              ? !Array.isArray(value) || value.length > 8 || value.some(topic => typeof topic !== 'string' || topic.length > 300)
              : !['level', 'goal', 'style', 'avoid'].includes(key) || typeof value !== 'string' || value.length > 1000)) {
            return json(400, { error: '偏好格式有误（最多 8 个主题，每项长度有限）' });
          }
          if ((dailyAt !== undefined && (typeof dailyAt !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyAt)))
            || (paused !== undefined && typeof paused !== 'boolean')) return json(400, { error: '请填写有效的研究时间' });
          return json(200, await agent.setPreferences({ preferences, dailyAt, paused }));
        }
        if (url.pathname === '/api/followups') {
          const { question, cardId, requestId = randomUUID() } = body;
          if (typeof question !== 'string' || !question.trim() || question.length > 500 || typeof requestId !== 'string' || !requestIdPattern.test(requestId)
            || (cardId !== undefined && (typeof cardId !== 'string' || !idPattern.test(cardId)))) return json(400, { error: '请输入 1–500 字的研究问题' });
          return json(201, await agent.queueQuestion(question.trim(), cardId, requestId));
        }
        const removeMatch = url.pathname.match(/^\/api\/followups\/(question-[a-zA-Z0-9-]{1,64})\/remove$/);
        if (removeMatch) {
          await agent.removeQuestion(removeMatch[1]);
          return json(200, { removed: true });
        }
        const retryMatch = url.pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/retry$/);
        if (retryMatch) {
          const event = await agent.retry(retryMatch[1]);
          void agent.tick();
          return json(202, { id: event.id });
        }
        return json(404, { error: '接口不存在' });
      }
      const asset = assets.get(url.pathname);
      if (request.method !== 'GET' || !asset) return json(404, { error: '页面不存在' });
      response.writeHead(200, {
        'Content-Type': asset.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
      });
      response.end(asset.content);
    } catch (error) { json(400, { error: error.message }); }
  });
  try {
    await agent.init();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', resolve); });
    timer = setInterval(() => { void agent.tick(); }, 1000);
    await agent.tick();
  } catch (error) { await release(); throw error; }
  return {
    agent, url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      clearInterval(timer);
      chatProxy.close();
      await agent.close();
      await new Promise(resolve => server.close(resolve));
      await release();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const service = await startServer(loadConfig());
    console.log(`悟 · 知识 Agent 已启动 ${service.url}`);
    console.log(`Obsidian Vault ${service.agent.config.vault}`);
    if (!service.agent.config.key) console.log('请将 .env.example 复制为 .env，填写 DEEPSEEK_API_KEY 后重启。');
    if (process.platform === 'win32' && process.argv.includes('--open') && !process.argv.includes('--no-open')) {
      execFile('rundll32.exe', ['url.dll,FileProtocolHandler', service.url], { windowsHide: true }, error => {
        if (error) console.error(`浏览器未能自动打开，请手动访问 ${service.url}`);
      });
    }
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await service.close();
      process.exit(0);
    };
    process.on('SIGINT', close);
    process.on('SIGTERM', close);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
