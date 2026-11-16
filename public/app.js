import { $, el, icon, hydrateIcons, link, button, pill, panelTitle, empty, markdown } from './ui.js';

const routes = { today: '今日工作台', chat: '与悟对话', agent: '研究追问', inbox: '研究收件箱', library: '我的知识库', settings: '研究偏好' };
const labels = { topics: '兴趣方向', level: '已有基础', goal: '学习目标', style: '阅读习惯', avoid: '减少推荐' };
const stages = { plan: '确定研究问题', search: '查找资料', fetch: '阅读原文', compose: '整理结论与证据', deliver: '写入收件箱', done: '已完成' };
const reviewColors = { 待审阅: 'blue', 暂缓: 'amber', 已入库: 'green', 等待入库: 'amber', 属性待检查: 'red' };
let state, syncing, offline = false, current = '', sending = false, researching = false, saving = false;
let replyTo = null, draftRequest = null, selectedReader = null, readSequence = 0;
let librarySequence = 0, libraryTimer, toastTimer, filter = '待审阅', settingsBase, libraryCountSeen;
let settingsDirty = false, settingsRevision = 0;
const signatures = new Map();
const shell = document.querySelector('.shell');
const chatFrame = $('chat-demo-frame');
const workspacePages = new Set(['today', 'inbox', 'library', 'agent', 'settings']);
const themeKey = 'chat-demo:theme-preference';
const sidebarKey = 'wu-workbench:sidebar';
const systemDark = matchMedia('(prefers-color-scheme: dark)');

function readPreference(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function syncTheme() {
  const preference = readPreference(themeKey);
  const dark = preference === 'dark' || (preference !== 'light' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.body.toggleAttribute('data-ds-dark-theme', dark);
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).backgroundColor;
}

function setSidebar(collapsed) {
  shell.dataset.nav = collapsed ? 'collapsed' : 'expanded';
  const toggle = $('sidebar-toggle');
  const label = collapsed ? '展开导航' : '收起导航';
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
}

function paint(id, data, draw) {
  const key = JSON.stringify(data);
  if (signatures.get(id) === key) return;
  const target = $(id);
  const activeKey = target.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
  draw(target);
  signatures.set(id, key);
  if (activeKey) [...target.querySelectorAll('[data-focus]')].find(item => item.dataset.focus === activeKey)?.focus({ preventScroll: true });
}

async function request(endpoint, body) {
  const response = await fetch(endpoint, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Wu-Token': state.csrf }, body: JSON.stringify(body),
  });
  if (response.status === 403 && body !== undefined) void refresh();
  let result;
  try { result = await response.json(); } catch { throw new Error('本地服务没有返回可读取的数据'); }
  if (!response.ok) throw new Error(result.error || '请求失败，请重试');
  return result;
}

function inform(message) {
  if ($('reader').open) {
    const status = $('reader-actions').querySelector('[role=status]');
    if (status) { status.textContent = message; return; }
  }
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4800);
}

function bindAction(control, action) {
  return async () => {
    if (control.disabled) return;
    control.disabled = true;
    try { await action(); }
    catch (error) { inform(error.message); }
    finally { control.disabled = false; }
  };
}

const topicList = () => state?.profile.preferences.topics?.value || [];
const pendingCards = () => state.cards.filter(card => ['待审阅', '等待入库', '属性待检查'].includes(card.review));
const isActive = event => ['pending', 'running'].includes(event.status);
const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);
const obsidian = (label, href, className = 'button secondary') => link(label, href, className, 'vault', 'external');
const day = value => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }).format(new Date(value + 'T00:00Z'));
const when = value => value ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: state.timezone }).format(new Date(value)) : '';
const reviewPill = value => pill(value, reviewColors[value]);
const focusKey = (node, key) => { node.dataset.focus = key; return node; };
const hasDirection = () => topicList().length || state?.followups.length;
function badge(id, count) { $(id).textContent = count; $(id).hidden = count === 0; }

function unanswered() {
  const addressed = new Set(state.events.filter(item => item.type === 'chat' && item.status !== 'failed').map(item => item.respondingTo?.id));
  const chats = state.outbox.filter(item => item.kind === 'reply' && item.question).slice(-1);
  const daily = state.outbox.filter(item => item.kind === 'daily' && item.question).slice(-1);
  const welcome = !topicList().length && !daily.length && !state.turns.length && !state.events.some(item => item.type === 'chat' && item.status !== 'failed')
    ? state.outbox.filter(item => item.kind === 'question').slice(-1) : [];
  return [...welcome, ...chats, ...daily].filter(item => !addressed.has(item.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function renderShell() {
  const label = offline ? '服务已断开' : !state ? '连接中' : state.configured ? 'DeepSeek 已配置' : '等待 API Key';
  const tone = offline ? 'red' : !state ? 'neutral' : state.configured ? 'green' : 'amber';
  paint('connection', label, node => { node.dataset.tone = tone; node.replaceChildren(el('span'), label); });
  paint('notice', [offline, state?.configured, state?.error], node => {
    node.hidden = !(offline || state?.configured === false || state?.error);
    node.classList.toggle('error', offline || Boolean(state?.error));
    if (offline) {
      node.replaceChildren(el('span', '', '没有连上本地服务。启动 start.cmd 后会自动恢复连接。'), button('重新连接', () => void refresh(), 'button secondary compact', 'refresh'));
    } else if (state?.error) node.replaceChildren(el('span', '', '后台状态：' + state.error));
    else if (state?.configured === false) node.replaceChildren(el('span', '', '在项目的 ', el('code', '', '.env'), ' 中填写 ', el('code', '', 'DEEPSEEK_API_KEY'), ' 后重启，即可对话和研究。已有知识仍可阅读。'));
  });
  $('send').disabled = !state?.configured || offline || sending;
  $('add-question').disabled = !state || offline;
  $('save-settings').disabled = !state || offline || saving;
  if (!state) return;
  for (const [id, url] of [['vault-link', state.vaultUri], ['inbox-link', state.inboxUri]]) {
    $(id).href = url; $(id).hidden = false;
  }
  const inbox = pendingCards().length;
  const agent = unanswered().length;
  badge('inbox-badge', inbox);
  badge('question-badge', agent);
  if (chatFrame.hasAttribute('src')) {
    chatFrame.contentWindow?.postMessage({ type: 'wu:workspace-summary', inbox, agent, vaultUri: state.vaultUri }, location.origin);
  }
}

async function refresh() {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      state = await request('/api/state');
    } catch {
      offline = true;
      render();
      return;
    }
    offline = false;
    render();
  })();
  try { await syncing; } finally { syncing = null; }
}

async function afterWrite() {
  if (syncing) await syncing;
  await refresh();
}

async function retry(event) {
  await request('/api/events/' + event.id + '/retry', {});
  await afterWrite();
  inform('已重新排队，将从保留的进度继续。');
}

async function startResearch() {
  if ($('start-research').disabled) return;
  researching = true; renderToday();
  try {
    await request('/api/research', {});
    await afterWrite();
    inform('研究任务已提交，可在研究记录查看进度。');
  } catch (error) { inform(error.message); }
  finally { researching = false; renderToday(); }
}

function cardRow(card, source = 'inbox') {
  const note = source === 'library';
  const time = card.date ? el('time', '', card.date) : null;
  if (time) time.dateTime = card.date;
  const row = focusKey(el('button', 'card-row',
    el('span', 'card-mark', icon(note ? 'book' : 'file')),
    el('span', 'card-text', el('span', 'card-line', el('strong', '', card.title), !note && reviewPill(card.review)),
      el('span', 'card-excerpt', card.excerpt || (card.available === false ? '候选文件已移动或删除' : '打开阅读正文'))),
    el('span', 'card-tail', time, icon('chevron'))), source + '-' + card.id);
  row.type = 'button';
  row.addEventListener('click', () => void readCard(card, source));
  return row;
}

function renderToday() {
  const researchEvents = state.events.filter(event => event.type === 'research');
  const active = researchEvents.find(isActive);
  const dailyId = 'research-' + state.date;
  const event = active || researchEvents.filter(item => item.id === dailyId || item.id.startsWith(dailyId + '-')).sort(newestFirst)[0];
  const run = state.runs.find(item => item.id === event?.id);
  const cards = pendingCards();
  const remaining = state.cards.filter(card => card.runId === run?.id);
  const nextReview = cards.some(card => card.runId === run?.id);
  const open = unanswered();
  const start = $('start-research');
  start.disabled = offline || researching || Boolean(active) || !state.configured || !hasDirection();
  start.querySelector('span').textContent = researching ? '正在排队…' : '立即研究';
  $('today-date').textContent = day(state.date);
  $('today-date').dateTime = state.date;
  badge('next-count', cards.length);
  $('all-pending').hidden = cards.length <= 4;
  paint('hero-content', [event, run, state.configured, offline, hasDirection(), state.paused, remaining.length, nextReview, state.followups[0], topicList()], node => {
    let status, tone;
    let title = '让研究从一个问题开始';
    let summary = '设置兴趣主题后，悟会围绕一个具体问题研究并整理候选卡片。';
    let actions = [];
    if (event?.status === 'done') {
      status = '已交付'; tone = 'green';
      title = run?.focus || '今日研究已完成';
      summary = run?.cardCount ? '已交付 ' + run.cardCount + ' 张候选卡片。' + (nextReview ? '可以核对原文证据后再收录。' : '')
        : '本次证据不足以生成新卡片。';
      if (nextReview) actions = [link('审阅候选卡片', '#inbox/pending', 'button primary', 'inbox')];
      else if (remaining.length) actions = [link('查看候选卡片', '#inbox/all', 'button primary', 'inbox')];
      else actions = [link('查看研究记录', '#inbox/history', 'button primary', 'clock')];
      if (run?.uri) actions.push(obsidian('阅读简报', run.uri));
    } else if (event?.status === 'failed') {
      status = '需要处理'; tone = 'red'; title = run?.focus || '研究未完成'; summary = event.error || '可以重试当前任务。';
      const control = button('重试今日研究', () => void bindAction(control, () => retry(event))(), 'button primary', 'refresh');
      control.disabled = offline || !state.configured;
      actions = [control, link('研究偏好', '#settings', 'button secondary', 'sliders')];
    } else if (event) {
      status = event.retryAt ? '等待重试' : '进行中'; tone = event.retryAt ? 'amber' : 'blue';
      title = run?.focus || '正在规划今天的研究';
      summary = event.retryAt ? '将在 ' + when(event.retryAt) + ' 自动重试。' : (stages[run?.stage || event.step] || '已排队，等待后台开始') + '。可以继续对话，结果会送到收件箱。';
      actions = [link('查看研究进度', '#inbox/history', 'button secondary', 'clock', 'arrow')];
    } else if (hasDirection()) {
      status = state.paused ? '自动研究已暂停' : '尚未开始'; tone = state.paused ? 'amber' : '';
      title = state.followups[0]?.question || '今天，继续探索 ' + topicList()[0];
      summary = state.followups[0] ? '这是你加入待研究的下一个问题。' : '悟会结合你的兴趣与已收录知识选择具体问题，并保留出处。';
      actions = [link('编辑研究偏好', '#settings', 'button secondary', 'sliders')];
    } else actions = [link('设置研究主题', '#settings', 'button primary', 'sliders', 'arrow'), link('告诉悟我的兴趣', '#agent', 'button secondary', 'chat')];
    const heading = el('h2', '', title); heading.id = 'hero-title';
    node.replaceChildren(el('div', 'research-label', icon('spark'), '今日研究', status && pill(status, tone)), heading,
      el('p', '', summary), el('div', 'research-actions', ...actions));
  });
  paint('next-cards', cards.slice(0, 4), node => node.replaceChildren(...(cards.length ? cards.slice(0, 4).map(card => cardRow(card, 'today'))
    : [empty('没有等你审阅的卡片', '研究生成的候选知识会出现在这里。也可以去收件箱查看历史。', { glyph: 'check' })])));
  paint('schedule-summary', [state.dailyAt, state.timezone, state.paused, state.cardLimit], node => {
    node.replaceChildren(panelTitle('每日安排', 'clock', pill(state.paused ? '已暂停' : '自动研究', state.paused ? 'amber' : 'blue')),
      el('div', 'schedule-time', el('strong', '', state.dailyAt), el('span', '', state.timezone)),
      el('p', 'muted', state.paused ? '仍可手动研究。' : '每天自动研究一次，每轮最多生成 ' + state.cardLimit + ' 张新卡。'),
      el('div', 'panel-footer', link('调整交付设置', '#settings/delivery', 'text-action', null, 'arrow')));
  });
  paint('today-next', [open, state.followups, state.libraryCount], node => {
    const item = open[0];
    const queued = state.followups[0];
    if (item) node.replaceChildren(panelTitle('悟想问你', 'chat'), el('p', 'muted', item.question),
      el('div', 'panel-footer', button('回复追问', () => useQuestion(item), 'text-action', 'arrow')));
    else if (queued) node.replaceChildren(panelTitle('接下来研究', 'spark'), el('p', 'muted', queued.question),
      el('div', 'panel-footer', link('查看待研究问题', '#settings/queue', 'text-action', null, 'arrow')));
    else node.replaceChildren(panelTitle('已积累的知识', 'book'), el('p', 'muted', '正式知识库共有 ' + state.libraryCount + ' 篇笔记。'),
      el('div', 'panel-footer', link('浏览知识库', '#library', 'text-action', null, 'arrow')));
  });
}

const inboxStatuses = ['待审阅', '全部', '暂缓', '跳过', '已入库'];
function renderInbox() {
  const counts = Object.fromEntries(inboxStatuses.map(status => [status, status === '全部' ? state.cards.length : status === '待审阅' ? pendingCards().length : state.cards.filter(card => card.review === status).length]));
  paint('filters', [filter, counts], node => node.replaceChildren(...inboxStatuses.map(status => {
    const item = focusKey(button(status, () => { filter = status; renderInbox(); }, ''), status);
    item.append(el('span', '', String(counts[status])));
    item.setAttribute('aria-pressed', String(status === filter));
    return item;
  })));
  const query = $('inbox-search').value.trim().toLowerCase();
  const rows = (filter === '待审阅' ? pendingCards() : state.cards.filter(card => filter === '全部' || card.review === filter))
    .filter(card => !query || (card.title + ' ' + card.excerpt).toLowerCase().includes(query));
  paint('inbox-cards', [rows, query, filter], node => node.replaceChildren(...(rows.length ? rows.map(card => cardRow(card))
    : [empty(query ? '没有找到匹配的卡片' : '这里暂时没有卡片', query ? '试试更短的关键词，或切换审阅状态。' : '切换状态可看历史卡片。新卡会在研究完成后送到这里。', { center: true })])));

  const events = state.events.filter(event => event.type === 'research' || (event.type === 'approval' && event.status === 'failed')).sort(newestFirst);
  const active = events.some(event => event.type === 'research' && isActive(event));
  paint('history', [events, state.runs, offline, state.configured, state.followups], node => {
    const open = new Set([...node.querySelectorAll('details[open]')].map(detail => detail.dataset.event));
    const entries = [];
    for (const event of events.slice(0, 30)) {
      const run = state.runs.find(item => item.id === event.id);
      const inProgress = isActive(event);
      const status = event.status === 'failed' ? '需要处理' : event.status === 'done' ? '已交付' : event.retryAt ? '等待重试' : stages[run?.stage || event.step] || '已排队';
      const title = run?.focus || (event.type === 'research' ? '每日研究' : '卡片入库');
      const date = run?.date || (event.type === 'research' ? event.id.slice(9, 19) : event.createdAt.slice(0, 10));
      const time = date && el('time', '', date);
      if (time) time.dateTime = date;
      const summary = focusKey(el('summary', '', el('span', 'card-mark', icon('clock')),
        el('span', 'run-body', el('strong', '', title), time),
        pill(status, event.status === 'failed' ? 'red' : event.status === 'done' ? 'green' : 'blue'),
        el('span', 'run-chevron', icon('chevron'))), event.id);
      const detail = el('details', 'run-row', summary);
      detail.dataset.event = event.id;
      detail.open = open.has(event.id) || (inProgress && event === events[0]);
      const info = el('div', 'run-detail');
      if (run?.stage === 'done' && run.cardCount !== undefined) info.append(el('p', '', '交付 ' + run.cardCount + ' 张候选卡片'));
      if (event.error) info.append(el('p', '', event.error));
      if (event.status === 'failed') {
        const control = button('重试', () => void bindAction(control, () => retry(event))(), 'text-action', 'refresh');
        control.disabled = offline || (event.type === 'research' && (!state.configured || active)); info.append(control);
      }
      if (run?.reason) info.append(el('p', '', run.reason));
      if (run?.uri) info.append(obsidian('在 Obsidian 阅读研究简报', run.uri, 'text-action'));
      for (const question of run?.nextQuestions || []) {
        const queued = state.followups.some(item => item.question === question);
        const control = button(queued ? '已加入：' + question : question + ' · 加入待研究', () => void bindAction(control, () => queueQuestion(question))(), 'text-action wrap-action', queued ? 'check' : 'plus');
        control.disabled = offline || queued;
        info.append(control);
      }
      if (run?.warnings?.length) info.append(el('ul', 'run-warning', ...run.warnings.map(warning => el('li', '', warning))));
      detail.append(info); entries.push(detail);
    }
    if (!entries.length) entries.push(empty('还没有研究记录', '开始研究后，可以在这里看进度、简报和后续问题。', { glyph: 'clock', center: true }));
    node.replaceChildren(...entries);
  });
}

async function loadLibrary() {
  const sequence = ++librarySequence;
  const query = $('library-search').value.trim();
  if (!$('library-cards').childElementCount) $('library-cards').replaceChildren(empty('正在读取知识库', '正在扫描 Obsidian 的正式笔记。', { glyph: 'book', center: true }));
  try {
    const result = await request('/api/library?q=' + encodeURIComponent(query));
    if (sequence !== librarySequence || current !== 'library') return;
    $('library-count').textContent = (query ? '匹配 ' : '正式笔记 ') + result.cards.length + ' 篇';
    $('library-cards').replaceChildren(...(result.cards.length ? result.cards.map(card => cardRow(card, 'library')) : [
      empty(query ? '没有匹配的正式笔记' : '第一张正式卡片还在等你',
        query ? '试试另一个关键词。搜索会匹配标题和正文。' : '在 Obsidian 确认候选卡片后，就能在这里读到正式笔记。',
        { glyph: 'book', center: true, action: query ? null : link('去研究收件箱', '#inbox', 'button secondary compact', 'inbox', 'arrow') }),
    ]));
  } catch (error) {
    if (sequence !== librarySequence || current !== 'library') return;
    $('library-cards').replaceChildren(empty('暂时无法读取知识库', error.message, { center: true, action: button('重新读取', () => void loadLibrary()) }));
  }
}

function useQuestion(item) {
  replyTo = item;
  $('reply-text').textContent = '回复：' + item.question;
  $('reply-context').hidden = false;
  if (current !== 'agent') { location.hash = 'agent'; route(); }
  $('message').focus();
}
function clearReply() { replyTo = null; $('reply-context').hidden = true; }

function renderChat() {
  $('chat-model').textContent = state.model + ' · 本地对话记录';
  const chats = state.events.filter(event => event.type === 'chat').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-40);
  const welcome = state.outbox.find(item => item.id === 'welcome');
  const open = unanswered();
  const openIds = new Set(open.map(item => item.id));
  paint('messages', [chats, state.turns, welcome, open, current, offline, state.configured, topicList()], node => {
    const keepBottom = !node.childElementCount || node.scrollHeight - node.scrollTop - node.clientHeight < 100;
    const position = node.scrollTop;
    const messages = [];
    if (!chats.length) messages.push(el('article', 'message', el('small', '', '悟'), el('p', '', topicList().length
      ? '我们正在关注「' + topicList()[0] + '」。你可以针对这个主题提问，或告诉我想调整的方向。' : welcome?.question || '你最近最想弄懂哪个问题？'),
      !topicList().length && button('从一个主题开始', () => {
        if (!$('message').value) $('message').value = '我想研究';
        $('message').focus();
      }, 'text-action', 'arrow')));
    for (const event of chats) {
      const turn = state.turns.find(item => item.id === event.id);
      const entry = el('article', 'message user', el('small', '', '你 · ' + when(event.createdAt)),
        event.respondingTo && el('small', '', '回复：' + event.respondingTo.question), el('div', 'user-text', event.message || turn?.user || ''));
      messages.push(entry);
      if (turn) {
        const response = el('article', 'message', el('small', '', '悟 · ' + when(turn.at)), el('div', 'prose', markdown(turn.reply)));
        if (turn.question) response.append(el('div', 'question-box', el('p', '', turn.question),
          openIds.has(event.id) && focusKey(button('回复这条追问', () => useQuestion({ id: event.id, question: turn.question }), 'text-action'), event.id)));
        messages.push(response);
      } else if (event.status === 'failed') {
        const control = focusKey(button('重试', () => void bindAction(control, () => retry(event))(), 'text-action', 'refresh'), 'retry-' + event.id);
        control.disabled = offline || !state.configured;
        messages.push(el('article', 'message failed', el('p', '', event.error || '这条消息没有处理成功。'), control));
      } else if (event.status !== 'done') messages.push(el('p', 'message pending', event.retryAt ? '正在等待自动重试…' : event.status === 'running' ? '悟正在整理回复…' : '消息已排队…'));
    }
    node.replaceChildren(...messages);
    node.scrollTop = keepBottom ? node.scrollHeight : position;
  });
  paint('chat-question', open, node => {
    node.replaceChildren(panelTitle('等待你回复', 'chat', open.length ? pill(open.length + ' 条', 'blue') : null),
      ...(!open.length ? [el('p', 'muted', '目前没有需要你补充的问题。')] : open.map(item =>
        el('div', 'panel-footer', el('p', 'muted', item.question), focusKey(button('回复追问', () => useQuestion(item), 'text-action', 'arrow'), item.id)))));
  });
  paint('chat-profile', state.profile.preferences, node => {
    const profile = el('dl', 'profile-list');
    for (const [key, preference] of Object.entries(state.profile.preferences)) {
      const value = preference.value;
      if (!labels[key] || !value?.length) continue;
      const dd = el('dd', Array.isArray(value) ? 'chips' : '', ...(Array.isArray(value) ? value.map(topic => el('span', '', topic)) : [value]));
      if (preference.evidence) dd.title = '来自你的话：' + preference.evidence;
      profile.append(el('div', '', el('dt', '', labels[key]), dd));
    }
    node.replaceChildren(panelTitle('悟记住的偏好', 'sliders'), profile.children.length ? profile : el('p', 'muted', '介绍你的兴趣和阅读习惯，或直接手动设置。'),
      el('div', 'panel-footer', link('查看与修改', '#settings', 'text-action', null, 'arrow')));
  });
}

function settingValues() {
  return Object.fromEntries(Object.keys(labels).map(key => [key, key === 'topics'
    ? $('pref-topics').value.split(/\r?\n/).map(topic => topic.trim()).filter(Boolean) : $('pref-' + key).value.trim()]));
}
function fillSettings(prefs = state.profile.preferences, dailyAt = state.dailyAt, paused = state.paused) {
  for (const key of Object.keys(labels)) $('pref-' + key).value = key === 'topics' ? (prefs[key]?.value || []).join('\n') : prefs[key]?.value || '';
  $('pref-time').value = dailyAt;
  $('pref-paused').checked = paused;
  $('timezone').textContent = state.timezone;
  settingsBase = { preferences: settingValues(), dailyAt, paused };
}
function settingsPatch() {
  const preferences = Object.fromEntries(Object.entries(settingValues()).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(settingsBase.preferences[key])));
  return { preferences, ...($('pref-time').value !== settingsBase.dailyAt && { dailyAt: $('pref-time').value }),
    ...($('pref-paused').checked !== settingsBase.paused && { paused: $('pref-paused').checked }) };
}
function renderSettings() {
  if (!settingsDirty && !saving && (!settingsBase || JSON.stringify([state.profile.preferences, state.dailyAt, state.paused]) !== signatures.get('settings-fields'))) {
    fillSettings();
    signatures.set('settings-fields', JSON.stringify([state.profile.preferences, state.dailyAt, state.paused]));
  }
  const locked = todayEvent()?.status !== 'done' && todayEvent()?.status !== 'failed' ? todayRun()?.followupId : null;
  paint('queue-list', [state.followups, locked, offline], node => node.replaceChildren(...(state.followups.length
    ? state.followups.map((item, index) => {
      const remove = focusKey(button('', () => void bindAction(remove, async () => {
        await request('/api/followups/' + item.id + '/remove', {});
        await afterWrite(); inform('已移除待研究问题。');
      })(), 'icon-button', 'close'), item.id);
      remove.setAttribute('aria-label', '移除：' + item.question); remove.title = '移除问题'; remove.disabled = offline;
      return el('div', 'queue-row', el('span', '', (index + 1) + '. ' + item.question), item.id === locked ? pill('研究中', 'blue') : remove);
    }) : [el('p', 'muted', '暂无待研究问题。也可以从候选卡片发起「继续深挖」。')])));
  paint('storage', state.vault, node => node.replaceChildren(panelTitle('内容保存在本机', 'vault'),
    el('p', 'muted', '候选与正式笔记都保存在 Obsidian Vault。确认、暂缓和跳过由候选笔记的 review 属性决定。'),
    el('code', 'path', state.vault), el('div', 'panel-footer', obsidian('在 Obsidian 打开', state.vaultUri, 'text-action'))));
}

function render() {
  renderShell();
  if (!state) return;
  if (current === 'today') renderToday();
  if (current === 'agent') renderChat();
  if (current === 'inbox') renderInbox();
  if (current === 'settings') renderSettings();
  if (current === 'library' && state.libraryCount !== libraryCountSeen) {
    libraryCountSeen = state.libraryCount;
    void loadLibrary();
  }
  if (selectedReader?.source !== 'library' && selectedReader?.data) {
    const next = state.cards.find(card => card.id === selectedReader.data.id);
    if (!next) $('reader').close();
    else if (selectedReader.data.review !== next.review) {
      Object.assign(selectedReader.data, next);
      drawReaderBanner(selectedReader.data);
      if (!$('reader-actions').querySelector('form')) drawReaderActions(selectedReader.data, selectedReader.source);
    }
  }
}

function route() {
  const hash = location.hash.slice(1);
  const [view, subview] = hash.split('/');
  const page = Object.hasOwn(routes, view) ? view : ({ conversation: 'agent', knowledge: 'inbox' }[view] || 'today');
  const settingsSection = page === 'settings' && ({ delivery: 'delivery-settings', queue: 'question-queue' }[subview]);
  if (page === 'inbox') {
    const history = subview === 'history';
    $('inbox-candidates').hidden = history;
    $('history').hidden = !history;
    $(history ? 'history-view-link' : 'cards-view-link').setAttribute('aria-current', 'page');
    $(history ? 'cards-view-link' : 'history-view-link').removeAttribute('aria-current');
    if (subview === 'all') filter = '全部';
    if (subview === 'pending') filter = '待审阅';
  }
  if (page === current) {
    if (state && page === 'inbox') renderInbox();
    if (settingsSection) showSettingsSection(settingsSection);
    return;
  }
  current = page;
  for (const anchor of document.querySelectorAll('[data-page]')) {
    if (anchor.dataset.page === page) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  }
  for (const key of Object.keys(routes)) $('page-' + key).hidden = key !== page;
  $('main').dataset.page = page;
  shell.dataset.page = page;
  document.title = routes[page] + ' · 悟';
  if (page === 'library') { libraryCountSeen = state?.libraryCount; void loadLibrary(); }
  if (page === 'agent') signatures.delete('messages');
  if (page === 'chat' && !chatFrame.hasAttribute('src')) chatFrame.src = '/chat-demo/?embed=workbench';
  render();
  if (settingsSection) showSettingsSection(settingsSection);
  else {
    window.scrollTo(0, 0);
    if (hash !== 'main') $('main').focus({ preventScroll: true });
  }
}

function showSettingsSection(id) {
  const section = $(id);
  section.scrollIntoView({ block: 'nearest' });
  section.focus({ preventScroll: true });
}

async function queueQuestion(question, cardId) {
  await request('/api/followups', { question, cardId, requestId: crypto.randomUUID() });
  await afterWrite();
  inform('已加入待研究，下次规划时按顺序处理。');
}

function drawReaderBanner(data) {
  $('reader-title').textContent = data.title;
  const meta = [];
  if (selectedReader.source !== 'library') meta.push(reviewPill(data.review));
  if (data.date) {
    const time = el('time', '', data.date);
    time.dateTime = data.date;
    meta.push(time);
  }
  $('reader-meta').replaceChildren(...meta);
  $('reader-meta').hidden = !meta.length;
}

function deleteCandidateButton(card) {
  const control = button('删除候选', () => {
    const dialog = $('delete-confirmation');
    $('delete-message').textContent = '将「' + card.title + '」移到 Vault 的回收站？';
    dialog.returnValue = '';
    dialog.showModal();
    dialog.addEventListener('close', () => {
      if (dialog.returnValue !== 'delete') return;
      void bindAction(control, async () => {
        await request('/api/cards/' + encodeURIComponent(card.id) + '/delete', {});
        if (selectedReader?.id === card.id && selectedReader.source !== 'library') $('reader').close();
        await afterWrite();
        inform('候选卡片已删除。');
      })();
    }, { once: true });
  }, 'button danger compact');
  control.disabled = offline;
  return control;
}

function drawReaderActions(data, source) {
  const candidate = source !== 'library';
  const control = candidate ? button('继续深挖', () => {
    if ($('reader-actions').querySelector('form')) return;
    const input = el('input'); input.value = '关于「' + data.title.slice(0, 150) + '」，有哪些可动手验证的做法？';
    input.maxLength = 500; input.required = true; input.setAttribute('aria-label', '想继续研究的问题');
    const submit = el('button', 'button primary compact', '加入待研究'); submit.type = 'submit';
    const cancel = button('取消', () => { form.remove(); control.hidden = false; control.focus(); }, 'button quiet compact');
    const form = el('form', '', input, submit, cancel);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!input.value.trim()) return;
      void bindAction(submit, async () => { await queueQuestion(input.value.trim(), data.id); form.remove(); control.hidden = false; control.focus(); })();
    });
    control.hidden = true;
    $('reader-actions').append(form); input.focus(); input.select();
  }, 'button secondary compact', 'plus') : null;
  if (control) control.disabled = offline;
  const help = candidate && data.review !== '已入库'
    ? '在 Obsidian 中把 review 改为「确认」即可入库，也可设为「暂缓」或「跳过」。' : '正式笔记可以在 Obsidian 中继续编辑。';
  const status = el('p', '', help);
  status.setAttribute('role', 'status');
  const uri = data.publishedUri || data.uri;
  $('reader-actions').replaceChildren(status, ...(candidate ? [deleteCandidateButton(data), control] : []),
    obsidian(candidate && data.review !== '已入库' ? '在 Obsidian 审阅' : '打开正式笔记', uri, 'button primary compact'));
}

async function readCard(card, source) {
  const sequence = ++readSequence;
  selectedReader = { source, id: card.id };
  $('reader-kind').replaceChildren(icon(source === 'library' ? 'book' : 'file'), source === 'library' ? '正式笔记' : '候选卡片');
  drawReaderBanner(card);
  $('reader-body').replaceChildren(el('p', 'muted', '正在读取笔记…'));
  $('reader-actions').replaceChildren();
  const reader = $('reader');
  if (!reader.open) reader.showModal();
  $('reader-main').scrollTop = 0;
  $('close-reader').focus();
  try {
    const data = await request('/api/' + (source === 'library' ? 'library/' : 'cards/') + encodeURIComponent(card.id));
    if (sequence !== readSequence || !reader.open) return;
    selectedReader.data = data;
    drawReaderBanner(data);
    $('reader-body').replaceChildren(markdown(data.body, { omitTitle: true }));
    drawReaderActions(data, source);
  } catch (error) {
    if (sequence !== readSequence || !reader.open) return;
    $('reader-body').replaceChildren(el('p', 'muted', error.message));
    const status = el('p'); status.setAttribute('role', 'status');
    $('reader-actions').replaceChildren(status, source === 'library' ? '' : deleteCandidateButton(card),
      card.available === false ? '' : obsidian('尝试在 Obsidian 打开', card.publishedUri || card.uri));
  }
}

$('chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('message');
  const text = input.value.trim();
  if (!text || sending || !state?.configured || offline) return;
  const question = replyTo;
  const key = JSON.stringify([text, question?.id]);
  if (draftRequest?.key !== key) draftRequest = { key, id: crypto.randomUUID() };
  sending = true; renderShell();
  try {
    await request('/api/chat', { text, requestId: draftRequest.id, replyTo: question?.id });
    if (input.value.trim() === text) input.value = '';
    if (replyTo === question) clearReply();
    draftRequest = null;
    await afterWrite();
    $('messages').scrollTop = $('messages').scrollHeight;
  } catch (error) { inform(error.message); }
  finally { sending = false; renderShell(); }
});
$('message').addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
    event.preventDefault(); $('chat-form').requestSubmit();
  }
});
$('clear-reply').addEventListener('click', () => { clearReply(); $('message').focus(); });
$('start-research').addEventListener('click', () => void startResearch());
$('sidebar-toggle').addEventListener('click', () => {
  const collapsed = $('sidebar-toggle').getAttribute('aria-expanded') === 'true';
  setSidebar(collapsed);
  try { localStorage.setItem(sidebarKey, collapsed ? 'collapsed' : 'expanded'); } catch {}
});
systemDark.addEventListener('change', syncTheme);
window.addEventListener('storage', event => {
  if (event.key === themeKey || event.key === null) syncTheme();
  if (event.key === sidebarKey || event.key === null) setSidebar(readPreference(sidebarKey) === 'collapsed');
});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== chatFrame.contentWindow) return;
  if (event.data?.type === 'wu:workspace-ready') renderShell();
  if (event.data?.type === 'wu:workspace-navigate' && current === 'chat' && workspacePages.has(event.data.page)) {
    location.hash = event.data.page;
  }
});
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  $('main').focus();
});
$('inbox-search').addEventListener('input', () => { if (state) renderInbox(); });
$('library-search').addEventListener('input', () => {
  ++librarySequence;
  clearTimeout(libraryTimer);
  libraryTimer = setTimeout(() => void loadLibrary(), 160);
});
$('queue-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('queue-question');
  const value = input.value.trim();
  if (!value || !state || offline) return;
  void bindAction($('add-question'), async () => { await queueQuestion(value); if (input.value.trim() === value) input.value = ''; })();
});
$('settings-form').addEventListener('input', () => { settingsDirty = true; settingsRevision++; $('save-status').textContent = ''; });
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state || offline || saving || !settingsBase) return;
  const patch = settingsPatch();
  if (patch.preferences.topics?.length > 8 || patch.preferences.topics?.some(topic => topic.length > 300)) {
    inform('兴趣方向最多 8 项，每项最多 300 字。'); $('pref-topics').focus(); return;
  }
  if (Object.keys(patch).length === 1 && !Object.keys(patch.preferences).length) {
    settingsDirty = false; fillSettings(); $('save-status').textContent = '设置没有变化'; return;
  }
  const revision = settingsRevision;
  saving = true; renderShell();
  try {
    const updated = await request('/api/preferences', patch);
    settingsBase = { preferences: Object.fromEntries(Object.keys(labels).map(key => [key, updated.preferences[key]?.value ?? (key === 'topics' ? [] : '')])), dailyAt: updated.dailyAt, paused: updated.paused };
    settingsDirty = settingsRevision !== revision;
    if (!settingsDirty) fillSettings(updated.preferences, updated.dailyAt, updated.paused);
    await afterWrite();
    $('save-status').textContent = settingsDirty ? '仍有未保存的改动' : '已保存';
  } catch (error) { inform(error.message); }
  finally { saving = false; renderShell(); }
});
$('close-reader').addEventListener('click', () => $('reader').close());
$('reader').addEventListener('close', () => { ++readSequence; selectedReader = null; });
$('reader').addEventListener('click', event => { if (event.target === $('reader')) $('reader').close(); });
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { void refresh(); if (current === 'library') void loadLibrary(); } });

hydrateIcons();
syncTheme();
setSidebar(readPreference(sidebarKey) === 'collapsed');
route();
void refresh();
setInterval(() => { if (!document.hidden) void refresh(); }, 2000);

