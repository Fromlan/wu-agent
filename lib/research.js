/**
 * Research prompts and schedule helpers for the knowledge workbench.
 *
 * Daily research is a normal DeepSeek Harness session started by the schedule
 * service: the agent reads workbench state with its tools, uses the ordinary
 * web tools, writes candidate cards, and ends with a brief. No separate model
 * key or research API is involved, and publishing stays a human decision.
 */

/** One-line task title marker, used to find a task that lost its state id. */
export const RESEARCH_TITLE = '知识研究';

const STEPS = [
  '1. 先调用 `knowledge_status` 读取用户的兴趣、基础、目标、阅读习惯、待研究问题和最近的卡片与简报。',
  '2. 如果队列里有待研究问题，用第一个作为今天的重点；否则从兴趣方向里收窄成一个今天能回答的具体问题。',
  '3. 用 `web_search` 找 2–3 个可靠来源，用 `web_fetch` 读原文。只依据读到的正文，不要凭记忆补来源。',
  '4. 只根据原文证据，调用 `knowledge_capture` 写 1–3 张候选卡片。每张只表达一个可复用的结论，写明适用条件，并摘录可直接核对的原文引文；证据不足就少写或不写。',
  '5. 调用 `knowledge_brief` 写下今天的研究简报：重点、实际查到的内容、下一步问题。',
  '6. 最后用中文简短汇报：今天研究了什么、新增几张候选卡片。提醒用户到侧栏的「知识工作台」审阅。',
];

const RULES = '约束：候选卡片由用户在工作台确认后才能进入知识库，你不要声称已经入库，也不要尝试修改已入库的笔记。';

/**
 * Validate and normalize a daily wall-clock time.
 * @param {unknown} value - `HH:mm` text.
 * @returns {string} normalized `HH:mm`.
 */
export function normalizeTime(value) {
  const match = String(value || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error('每日研究时间应写成 HH:mm，例如 09:00');
  return `${match[1]}:${match[2]}`;
}

/**
 * Compose a research instruction.
 * @param {string} first - opening line describing this run.
 * @returns {string} the prompt.
 */
function prompt(first) {
  return [`你是「悟 · 知识工作台」的研究员。${first}`, '', ...STEPS, '', RULES].join('\n');
}

/**
 * The instruction delivered to every daily research session.
 * @returns {string} the prompt.
 */
export function dailyPrompt() {
  return prompt('现在完成今天这一轮研究。');
}

/**
 * Prompt for a single on-demand research session.
 * @returns {string} the prompt.
 */
export function nowPrompt() {
  return prompt('用户手动发起了一轮研究，不必等待每日定时。');
}

/**
 * A schedule task title that names its kind and date without colliding.
 * @param {'daily'|'now'} kind - task kind.
 * @param {string} date - `YYYY-MM-DD`.
 * @returns {string} bounded title.
 */
export function researchTitle(kind, date) {
  return kind === 'daily' ? `${RESEARCH_TITLE} · 每日` : `${RESEARCH_TITLE} · 立即 ${date}`;
}
