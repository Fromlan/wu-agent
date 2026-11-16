import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { projectRoot } from '../src/config.mjs';
import { startServer } from '../src/server.mjs';

test('完整对话从本机加载，流式生成和附件语音走固定的 DeepSeek 接口', { timeout: 15_000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wu-chat-demo-'));
  const calls = [];
  let finishStream;
  const mock = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    calls.push({ url: request.url, method: request.method, headers: request.headers, body });

    if (request.url === '/anthropic/v1/messages') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write('event: content_block_delta\ndata: {"type":"text_delta","text":"**回答**"}\n\n');
      await new Promise(resolve => { finishStream = resolve; });
      response.end('event: message_stop\ndata: {"type":"message_stop"}\n\n');
      return;
    }
    if (request.url === '/v1/tools/tts') {
      response.writeHead(200, { 'Content-Type': 'audio/pcm' });
      response.end(Buffer.from([20, 0, 40, 0]));
      return;
    }
    if (request.method === 'DELETE') {
      response.writeHead(204).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(request.url.endsWith('/asr') ? { text: '录音转写' } : { id: 'file-api-fixture' }));
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');

  let service;
  try {
    service = await startServer({
      root: projectRoot, stateDir: path.join(directory, 'state'), vault: path.join(directory, 'vault'),
      key: 'server-only-fixture-key', model: 'deepseek-flash', apiBase: 'http://127.0.0.1:' + mock.address().port,
      port: 0, dailyAt: '23:59', timezone: 'Asia/Shanghai', cardLimit: 3, queryLimit: 3, sourceLimit: 4,
    });
    const home = await fetch(service.url + '/chat-demo/');
    const html = await home.text();
    assert.equal(home.status, 200);
    assert.match(html, /data-wu-configured="yes"/);
    assert.doesNotMatch(html, /server-only-fixture-key/);
    assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    const workbench = await (await fetch(service.url + '/')).text();
    assert.match(workbench, /href="\/chat-demo\/theme\.css"/);
    assert.match(html, /href="theme\.css"/);
    const theme = await fetch(service.url + '/chat-demo/theme.css');
    assert.equal(theme.status, 200);
    assert.match(theme.headers.get('content-type'), /^text\/css/);
    assert.match(await theme.text(), /--dsw-alias-bg-base/);
    const scriptPath = html.match(/<script[^>]+src="([^"]+)"/)[1];
    const script = await fetch(new URL(scriptPath, service.url + '/chat-demo/'));
    assert.equal(script.status, 200);
    assert.match(await script.text(), /\/api\/chat-demo/);

    const proxy = (route, options = {}) => fetch(service.url + '/api/chat-demo' + route, {
      ...options, headers: { 'X-Wu-Chat': '1', ...options.headers },
    });
    assert.equal((await fetch(service.url + '/api/chat-demo/models')).status, 403);
    assert.equal((await proxy('/models', { headers: { Origin: 'https://other.example' } })).status, 403);
    assert.equal((await proxy('/v1/tools/search', { method: 'POST' })).status, 404);
    assert.equal(calls.length, 0);

    await fs.writeFile(service.agent.vaultPath('知识库', '光谱仪.md'), '# 光谱仪\n光谱仪需要定期校准。');
    await fs.writeFile(service.agent.vaultPath('每日审阅', '候选卡片', 'draft.md'), '# 光谱仪\n尚未审阅的内容。');
    const messages = [{ role: 'user', content: '光谱仪如何使用？' }];
    const stream = await proxy('/anthropic/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer browser-provided' },
      body: JSON.stringify({ model: 'deepseek-flash', stream: true, messages, thinking: { type: 'enabled' }, tools: [{ name: 'deepseek_web_search' }] }),
    });
    assert.equal(stream.headers.get('content-type'), 'text/event-stream');
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    const first = await reader.read();
    assert.match(decoder.decode(first.value, { stream: true }), /\*\*回答\*\*/);
    finishStream();
    assert.match(decoder.decode((await reader.read()).value), /message_stop/);
    await reader.read();

    const upstream = JSON.parse(calls[0].body.toString());
    assert.deepEqual(upstream.messages, messages);
    assert.equal(upstream.tools[0].name, 'deepseek_web_search');
    assert.equal(upstream.thinking.type, 'enabled');
    assert.match(upstream.system, /需要定期校准/);
    assert.doesNotMatch(upstream.system, /尚未审阅的内容/);
    assert.equal(calls[0].headers.authorization, 'Bearer server-only-fixture-key');

    const form = new FormData();
    form.append('purpose', 'text_recognition');
    form.append('file', new Blob(['附件正文']), 'sample.txt');
    const files = await proxy('/anthropic/v1/files', { method: 'POST', body: form, headers: { 'anthropic-beta': 'files-api-2025-04-14' } });
    assert.equal((await files.json()).id, 'file-api-fixture');
    assert.equal(calls.at(-1).headers['anthropic-beta'], 'files-api-2025-04-14');
    assert.match(calls.at(-1).body.toString(), /附件正文/);
    assert.equal((await proxy('/anthropic/v1/files/file-api-fixture', { method: 'DELETE' })).status, 204);
    const recording = new FormData();
    recording.append('file', new Blob(['voice fixture']), 'recording.wav');
    assert.equal((await (await proxy('/v1/tools/asr', { method: 'POST', body: recording })).json()).text, '录音转写');
    const audio = await proxy('/v1/tools/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '朗读' }),
    });
    assert.equal(audio.headers.get('content-type'), 'audio/pcm');
    assert.deepEqual(new Uint8Array(await audio.arrayBuffer()), Uint8Array.of(20, 0, 40, 0));
  } finally {
    finishStream?.();
    if (service) await service.close();
    await new Promise(resolve => mock.close(resolve));
    if (directory.startsWith(path.join(os.tmpdir(), 'wu-chat-demo-'))) await fs.rm(directory, { recursive: true, force: true });
  }
});
