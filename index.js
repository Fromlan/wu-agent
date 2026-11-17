/**
 * Knowledge workbench — Host half.
 *
 * Owns the Markdown vault, the agent-facing tools, the browser JSON API, and
 * the daily-research schedule. The browser half ({@link ./client.js}) only
 * renders and calls this file's HTTP API.
 *
 * Nothing here calls a model or the network: research happens in a normal
 * Harness session that the schedule service starts, so it reuses whatever the
 * user already configured (model, web search, permissions).
 */

import os from 'node:os';
import path from 'node:path';
import { KnowledgeStore, messageOf } from './lib/store.js';
import { registerTools } from './lib/tools.js';
import { machineTimeZone } from './lib/note.js';
import { dailyPrompt, nowPrompt, normalizeTime, researchTitle } from './lib/research.js';

/** Route prefix owned by this plugin. */
export const ROUTE = '/plugin/dsh-knowledge-workbench';

/** Largest accepted POST body. */
const MAX_BODY = 256 * 1024;

/** Default vault, used when the row config names none. */
export function defaultVault() {
  return path.join(os.homedir(), 'Documents', 'DSH知识库');
}

/**
 * Host entry point.
 * @param {object} ctx - Cordis context of this plugin row.
 * @param {{vault?: string, timeZone?: string}} [config] - row configuration.
 */
export function apply(ctx, config = {}) {
  const vault = path.resolve(typeof config.vault === 'string' && config.vault.trim() ? config.vault.trim() : defaultVault());
  const timeZone = typeof config.timeZone === 'string' && config.timeZone.trim() ? config.timeZone.trim() : machineTimeZone();
  const store = new KnowledgeStore({ vault, timeZone });

  registerTools(ctx, store);

  ctx.inject(['webServer'], scope => {
    const webServer = scope.webServer;
    const router = createRouter({
      store,
      origin: () => webServer.getOrigin(),
      // Connection owns Host/Origin trust when it is mounted; only a profile
      // without it falls back to a strict same-host check.
      enforceHost: () => !scope.get('connection'),
      authorize: headers => {
        const connection = scope.get('connection');
        if (!connection) return 0;
        try {
          return connection.requestRejection({ headers }) || 0;
        } catch {
          return 403;
        }
      },
      schedule: () => scope.get('schedule'),
    });
    scope.effect(() => webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: async (request, response) => {
        try {
          await router(request, response);
        } catch (error) {
          sendJson(response, 500, { ok: false, error: messageOf(error) });
        }
      },
    }), 'knowledge-workbench: browser api');
  });
}

/* ------------------------------------------------------------------ */
/* HTTP API                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build the browser API handler. Exported so tests can drive it without a
 * listening server.
 * @param {object} deps - store, origin, enforceHost, authorize, and schedule accessors.
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>} handler.
 */
export function createRouter(deps) {
  const { store, origin, enforceHost = () => true, authorize, schedule } = deps;
  return async function handle(request, response) {
    const url = new URL(request.url || '/', origin());
    if (enforceHost() && !isSameHost(request, origin())) {
      sendJson(response, 403, { ok: false, error: '只允许本机页面访问知识工作台' });
      return;
    }
    const rejection = authorize(request.headers);
    if (rejection) {
      sendJson(response, rejection, { ok: false, error: rejection === 401 ? '页面会话已失效，请刷新页面' : '请求来源无效' });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      response.writeHead(405, { Allow: 'GET, POST' });
      response.end();
      return;
    }
    const sub = url.pathname.startsWith(ROUTE) ? url.pathname.slice(ROUTE.length) : url.pathname;
    const endpoint = `${request.method} ${sub.replace(/\/+$/, '') || '/'}`;
    try {
      if (endpoint === 'GET /state') {
        sendJson(response, 200, { ok: true, ...(await snapshot(store, schedule())) });
        return;
      }
      if (endpoint === 'GET /card') {
        const card = await store.getCandidate(String(url.searchParams.get('id') || ''));
        sendJson(response, 200, { ok: true, ...card });
        return;
      }
      if (endpoint === 'GET /note') {
        const note = await store.getLibraryNote(String(url.searchParams.get('id') || ''));
        sendJson(response, 200, { ok: true, ...note });
        return;
      }
      if (endpoint === 'GET /brief') {
        const brief = await store.getBrief(String(url.searchParams.get('date') || ''));
        sendJson(response, 200, { ok: true, ...brief });
        return;
      }
      if (request.method === 'POST') {
        const body = await readJson(request);
        if (endpoint === 'POST /init') {
          await store.ensure();
          sendJson(response, 200, { ok: true, vault: store.vault });
          return;
        }
        if (endpoint === 'POST /review') {
          const id = String(body.id || '');
          const action = String(body.action || '');
          if (!['approve', 'hold', 'skip', 'pending', 'delete'].includes(action)) {
            sendJson(response, 400, { ok: false, error: '未知的审阅操作' });
            return;
          }
          const result = await store.reviewCard(id, action);
          sendJson(response, 200, { ok: true, ...result, state: await snapshot(store, schedule()) });
          return;
        }
        if (endpoint === 'POST /preferences') {
          const preferences = await store.savePreferences(body);
          sendJson(response, 200, { ok: true, preferences, state: await snapshot(store, schedule()) });
          return;
        }
        if (endpoint === 'POST /followup') {
          const question = String(body.question || '');
          const item = await store.addFollowup(question, typeof body.cardId === 'string' ? body.cardId : undefined);
          sendJson(response, 200, { ok: true, followup: item, state: await snapshot(store, schedule()) });
          return;
        }
        if (endpoint === 'POST /followup/remove') {
          const followups = await store.removeFollowup(String(body.id || ''));
          sendJson(response, 200, { ok: true, followups, state: await snapshot(store, schedule()) });
          return;
        }
        if (endpoint === 'POST /research') {
          const result = await researchAction(store, schedule(), body);
          sendJson(response, 200, { ok: true, ...result, state: await snapshot(store, schedule()) });
          return;
        }
        sendJson(response, 404, { ok: false, error: '接口不存在' });
        return;
      }
      sendJson(response, 404, { ok: false, error: '接口不存在' });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: messageOf(error) });
    }
  };
}

/**
 * The complete panel snapshot, shared by the read route and every action
 * response so a browser update never drops the research or config rows.
 * @param {KnowledgeStore} store - vault store.
 * @param {object|undefined} service - schedule service.
 * @returns {Promise<object>} status plus research and config.
 */
async function snapshot(store, service) {
  return {
    ...(await store.status()),
    research: await researchStatus(store, service),
    config: { vault: store.vault, timeZone: store.timeZone },
  };
}

/** Compare the request Host header with the listening origin. */function isSameHost(request, origin) {
  let expected;
  try {
    expected = new URL(origin).host;
  } catch {
    return false;
  }
  return String(request.headers.host || '') === expected;
}

/** Write one JSON response with no-store caching. */
function sendJson(response, status, value) {
  if (response.headersSent) {
    response.end();
    return;
  }
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

/** Read and parse a bounded JSON request body. */
async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('请求内容过大');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('请求内容不是有效 JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求格式有误');
  return value;
}

/* ------------------------------------------------------------------ */
/* Research schedule                                                   */
/* ------------------------------------------------------------------ */

/**
 * Read the daily-research task state without creating a session.
 * @param {KnowledgeStore} store - vault store.
 * @param {object|undefined} service - schedule service.
 * @returns {Promise<object>} the panel's research row.
 */
async function researchStatus(store, service) {
  const state = await store.readState();
  let task = null;
  if (service && state.researchScheduleId) {
    try {
      const view = await service.view({ id: state.researchScheduleId });
      if (view && !view.code) task = view;
    } catch {
      task = null;
    }
  }
  const queued = await queuedRun(state, service);
  return {
    available: Boolean(service),
    enabled: Boolean(task && task.status === 'active'),
    time: state.dailyAt,
    id: state.researchScheduleId || null,
    status: task ? task.status : state.researchScheduleId ? 'missing' : 'off',
    nextRunAt: task && task.status === 'active' ? task.scheduledAt : null,
    lastDelivery: task && task.lastDelivery
      ? { at: task.lastDelivery.deliveredAt, sessionId: task.lastDelivery.targetSessionId }
      : null,
    queued,
  };
}

/**
 * Report a one-off "research now" task while it is still pending, so the
 * panel can show that a run is queued instead of relying on a transient
 * toast. The stored id is ignored once the task is two minutes past its
 * scheduled instant, so a stuck or lingering task cannot keep the panel in a
 * queued state.
 * @param {object} state - persisted workbench state.
 * @param {object|undefined} service - schedule service.
 * @returns {Promise<{id: string, scheduledAt: string} | null>} the queued run.
 */
async function queuedRun(state, service) {
  const pending = state.pendingRun;
  if (!service || !pending || typeof pending.id !== 'string') return null;
  const scheduledAt = Date.parse(String(pending.scheduledAt || ''));
  if (!Number.isFinite(scheduledAt)) return null;
  if (Date.now() - scheduledAt > 2 * 60 * 1000) return null;
  try {
    const view = await service.view({ id: pending.id });
    if (!view || view.code || view.status !== 'active') return null;
    if (view.lastDelivery && view.lastDelivery.deliveredAt) return null;
    return { id: pending.id, scheduledAt: pending.scheduledAt || new Date(scheduledAt).toISOString() };
  } catch {
    return null;
  }
}

/**
 * Run one research-panel operation.
 * @param {KnowledgeStore} store - vault store.
 * @param {object|undefined} service - schedule service.
 * @param {Record<string, unknown>} body - action and optional time.
 * @returns {Promise<{research: object}>} the new research row.
 */
async function researchAction(store, service, body) {
  const action = String(body.action || '');
  if (!service) throw new Error('当前 profile 没有 schedule 服务，无法启动研究任务');
  const state = await store.readState();
  if (action === 'save-time') {
    const time = normalizeTime(body.time);
    await store.updateState(current => {
      current.dailyAt = time;
      return current;
    });
    return { research: await researchStatus(store, service) };
  }
  if (action === 'disable') {
    if (state.researchScheduleId) {
      try {
        await service.edit({ id: state.researchScheduleId, action: 'delete' });
      } catch {
        /* A task already removed elsewhere is the desired end state. */
      }
    }
    await store.updateState(current => {
      current.researchScheduleId = null;
      return current;
    });
    return { research: await researchStatus(store, service) };
  }
  if (action === 'enable') {
    const time = normalizeTime(body.time || state.dailyAt);
    let task = null;
    if (state.researchScheduleId) {
      try {
        const view = await service.view({ id: state.researchScheduleId });
        if (view && !view.code) task = view;
      } catch {
        task = null;
      }
    }
    const timing = { kind: 'daily', daily: { time, time_zone: store.timeZone } };
    let entry;
    if (task) {
      const edited = await service.edit({ id: state.researchScheduleId, action: 'update', patch: { timing, active: true } });
      if (edited && edited.code) throw new Error('每日研究任务状态异常，请先关闭再重新开启');
      entry = edited;
    } else {
      entry = await service.create({
        title: researchTitle('daily'),
        prompt: dailyPrompt(),
        timing,
        target: { kind: 'new' },
      });
    }
    await store.updateState(current => {
      current.dailyAt = time;
      current.researchScheduleId = entry.id;
      return current;
    });
    return { research: await researchStatus(store, service) };
  }
  if (action === 'start') {
    const entry = await service.create({
      title: researchTitle('now', store.today),
      prompt: nowPrompt(),
      timing: { kind: 'after', after_seconds: 10 },
      target: { kind: 'new' },
    });
    await store.updateState(current => {
      current.pendingRun = { id: entry.id, scheduledAt: entry.scheduledAt || new Date().toISOString() };
      return current;
    });
    return {
      research: await researchStatus(store, service),
      task: { id: entry.id, scheduledAt: entry.scheduledAt },
    };
  }
  throw new Error('未知的研究操作');
}
