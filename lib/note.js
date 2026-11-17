/**
 * Markdown note primitives for the knowledge workbench.
 *
 * The vault is plain Markdown so Obsidian, git, and a person can read it
 * without this plugin. Only a small YAML subset is written (scalars and string
 * arrays) and parsed (quoted, single-quoted, JSON arrays, bare scalars), so a
 * hand edit such as `review: 确认` keeps working.
 */

import { randomBytes } from 'node:crypto';

/** Review states a candidate card can carry in its frontmatter. */
export const REVIEW = Object.freeze({
  pending: '待审阅',
  hold: '暂缓',
  skip: '跳过',
  approved: '已入库',
});

/** Frontmatter keys written for a card, in display order. */
const CARD_KEYS = [
  'id', 'kind', 'title', 'aliases', 'created', 'updated', 'review', 'approved',
  'tags', 'summary', 'card_type', 'question', 'source_count', 'sources',
];

/** The inbox-only hint that must not survive publishing. */
export const REVIEW_HINT = '把顶部 review 改成「确认」也可以入库；工作台里的确认按钮等价。确认后这张卡会移动到「知识库」。';

/**
 * Format one instant as the wall-clock date of a time zone.
 * @param {Date} [now] - instant to format.
 * @param {string} [timeZone] - IANA zone; the machine zone when omitted.
 * @returns {string} `YYYY-MM-DD`.
 */
export function localDate(now = new Date(), timeZone = undefined) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * Build a sortable, file-safe card id.
 * @param {string} date - `YYYY-MM-DD`.
 * @returns {string} `kb-YYYYMMDD-xxxxxx`.
 */
export function newCardId(date) {
  return `kb-${date.replaceAll('-', '')}-${randomBytes(3).toString('hex')}`;
}

/**
 * Whether a string is a safe single-segment card id.
 * @param {unknown} value - candidate id.
 * @returns {boolean} true for `kb-` ids made of letters, digits, and dashes.
 */
export function isCardId(value) {
  return typeof value === 'string' && /^kb-[a-z0-9-]{4,80}$/.test(value);
}

/**
 * Encode a vault-relative Markdown path as a stable, URL-safe note id.
 * @param {string} relative - POSIX-style path below the library root.
 * @returns {string} base64url id.
 */
export function encodeNoteId(relative) {
  return Buffer.from(relative, 'utf8').toString('base64url');
}

/**
 * Decode a note id and reject anything that could escape the vault.
 * @param {string} id - base64url note id.
 * @returns {string} POSIX-style relative path.
 */
export function decodeNoteId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,2048}$/.test(id)) throw new Error('笔记 ID 无效');
  const relative = Buffer.from(id, 'base64url').toString('utf8');
  if (!relative || relative.includes('\0') || relative.startsWith('/') || relative.split('/').includes('..')) {
    throw new Error('笔记 ID 无效');
  }
  if (!relative.endsWith('.md')) throw new Error('笔记 ID 无效');
  return relative;
}

/**
 * Normalize tags to at most six short, unique strings.
 * @param {unknown} value - array or comma-separated string.
 * @returns {string[]} cleaned tags.
 */
export function normalizeTags(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，、;；\n]/) : [];
  const seen = new Set();
  const tags = [];
  for (const raw of list) {
    const tag = String(raw ?? '').trim().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, 24);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length === 6) break;
  }
  return tags;
}

/**
 * Quote one frontmatter scalar. Numbers and booleans stay unquoted so Bases
 * reads them as numeric and boolean properties rather than text.
 * @param {unknown} value - scalar value.
 * @returns {string} YAML scalar text.
 */
function scalar(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(String(value ?? ''));
}

/**
 * Render frontmatter lines for a card, omitting empty values.
 * @param {Record<string, unknown>} meta - card properties.
 * @returns {string} the `---` block, including the closing newline.
 */
export function renderFrontmatter(meta) {
  const keys = [...CARD_KEYS, ...Object.keys(meta).filter(key => !CARD_KEYS.includes(key))];
  const lines = [];
  for (const key of keys) {
    if (!(key in meta)) continue;
    const value = meta[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      lines.push(`${key}: ${JSON.stringify(value.map(String))}`);
    } else {
      lines.push(`${key}: ${scalar(value)}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n`;
}

/**
 * Parse a YAML-subset frontmatter block.
 * @param {string} text - whole note.
 * @returns {{ meta: Record<string, string | string[]>, body: string }} properties and body.
 */
export function parseNote(text) {
  const normalized = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: normalized };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const property = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/);
    if (!property) continue;
    const raw = property[2];
    if (raw === '') {
      meta[property[1]] = '';
      continue;
    }
    if (raw.startsWith('[')) {
      try {
        const value = JSON.parse(raw);
        meta[property[1]] = Array.isArray(value) ? value.map(String) : String(value);
        continue;
      } catch {
        meta[property[1]] = raw;
        continue;
      }
    }
    if (raw.startsWith('"')) {
      try {
        meta[property[1]] = JSON.parse(raw);
        continue;
      } catch {
        /* fall through to the unquoted form */
      }
    }
    if (raw.startsWith("'") && raw.endsWith("'")) {
      meta[property[1]] = raw.slice(1, -1).replace(/''/g, "'");
      continue;
    }
    meta[property[1]] = raw;
  }
  return { meta, body: match[2] };
}

/**
 * Read the first line of one `##` section.
 * @param {string} body - Markdown body.
 * @param {string} heading - section heading text.
 * @returns {string} first non-empty line, or an empty string.
 */
export function sectionLine(body, heading) {
  const match = body.match(new RegExp(`^##\\s*${heading}\\s*$`, 'm'));
  if (!match || match.index === undefined) return '';
  const rest = body.slice(match.index + match[0].length).split('\n');
  for (const line of rest) {
    const value = line.trim();
    if (!value) continue;
    if (value.startsWith('#')) return '';
    return value.replace(/^[-*>]\s*/, '').slice(0, 240);
  }
  return '';
}

/**
 * Derive a one-line summary from a card body.
 *
 * Legacy cards lead with `## 核心结论`; current cards lead with a blockquote
 * takeaway. Both are preferred over the first plain paragraph so the list and
 * Obsidian Bases stay useful without parsing frontmatter.
 * @param {string} body - Markdown body.
 * @returns {string} bounded excerpt.
 */
export function excerptOf(body) {
  const claim = sectionLine(body, '核心结论');
  if (claim) return claim;
  const lede = String(body).match(/^\s*>\s?(.+)$/m);
  if (lede) return lede[1].trim().slice(0, 240);
  for (const line of String(body).split('\n')) {
    const value = line.trim();
    if (!value || /^(#{1,6}\s|[-*>]|\||!\[|```)/.test(value)) continue;
    return value.slice(0, 240);
  }
  return '';
}

/**
 * Remove the inbox-only review hint before a card enters the library.
 * @param {string} body - Markdown body, with or without the hint.
 * @returns {string} the body without the trailing hint.
 */
export function stripReviewHint(body) {
  const escaped = REVIEW_HINT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(body).replace(new RegExp(`\\n*---\\n\\n${escaped}\\s*$`), '').trim();
}

/**
 * Render a concept article, comparison, or legacy scene/why/how card. Article
 * explanations stay in prose; comparisons use the same dimensions for both
 * subjects. Source mapping and author review remain available in Markdown.
 * @param {object} card - validated card fields.
 * @param {string} card.id - card id.
 * @param {string} card.title - concept and question or key distinction.
 * @param {string} card.takeaway - the new understanding for the reader.
 * @param {string} [card.type] - concept or comparison; absent for legacy cards.
 * @param {string} [card.question] - the question answered.
 * @param {string} [card.definition] - precise definitions.
 * @param {string} [card.mechanism] - mechanism and causal reasoning.
 * @param {string[]} [card.subjects] - two comparison subjects.
 * @param {object[]} [card.comparison] - shared dimensions with both sides and implications.
 * @param {string} [card.evidenceNote] - evidence status and uncertainties.
 * @param {string} [card.reviewNote] - author editorial revisions and remaining doubts.
 * @param {string} [card.scene] - legacy concrete situation.
 * @param {string} [card.why] - legacy mechanism.
 * @param {string} [card.how] - legacy procedure.
 * @param {string} card.limits - boundaries, counterexamples, costs, and tradeoffs.
 * @param {string} [card.check] - legacy verification instructions.
 * @param {string} [card.related] - optional Markdown bullets linking other cards.
 * @param {string} card.created - creation date.
 * @param {string} [card.updated] - last edit timestamp.
 * @param {string} card.review - review state.
 * @param {string} [card.approved] - publish timestamp.
 * @param {string[]} card.tags - tags.
 * @param {string} [card.summary] - one-line takeaway shown in Bases; defaults to `takeaway`.
 * @param {number} [card.source_count] - numeric evidence count for Bases.
 * @param {{url: string, title?: string, quote: string, supports?: string}[]} card.sources - evidence.
 * @returns {string} the Markdown note.
 */
export function renderCard(card) {
  const sources = card.sources.map((source, index) => {
    const label = source.title ? `[${source.title}](${source.url})` : source.url;
    const supports = source.supports ? ` — 支撑「${source.supports}」` : '';
    return `${index + 1}. ${label}${supports}\n\n   > ${source.quote.replace(/\n/g, '\n   > ')}`;
  });
  const related = String(card.related || '').trim();
  // Escape table separators without injecting HTML into the small UI renderer.
  const cell = value => String(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' / ');
  const comparison = card.type === 'comparison'
    ? ['## 概念比较', '', `| 共同维度 | ${cell(card.subjects[0])} | ${cell(card.subjects[1])} | 差异的影响 |`,
      '| --- | --- | --- | --- |',
      ...card.comparison.map(row => `| ${cell(row.dimension)} | ${cell(row.left)} | ${cell(row.right)} | ${cell(row.implication)} |`)].join('\n')
    : '';
  const sections = card.type
    ? `## 研究问题

${card.question}

## 概念定义

${card.definition}

## 机制解释

${card.mechanism}

${comparison ? `${comparison}\n\n` : ''}## 边界与取舍

${card.limits}

## 证据与不确定性

${card.evidenceNote}

## 审读记录

作者自检，不代表独立核验：${card.reviewNote}`
    : `## 场景

${card.scene}

## 原理

${card.why}

## 做法

${card.how}

## 边界与取舍

${card.limits}

## 怎么验证

${card.check}`;
  return `${renderFrontmatter({
    id: card.id,
    kind: 'card',
    title: card.title,
    aliases: [card.title],
    created: card.created,
    updated: card.updated || undefined,
    review: card.review,
    approved: card.approved || undefined,
    tags: card.tags,
    summary: card.summary || card.takeaway,
    card_type: card.type,
    question: card.question,
    source_count: card.source_count,
    sources: card.sources.map(source => source.url),
  })}
# ${card.title}

> ${card.takeaway}

${sections}

${related ? `## 关联\n\n${related}\n\n` : ''}## 来源

${sources.join('\n\n')}

---

${REVIEW_HINT}
`;
}

/** Timezone of this machine, used when the plugin's config names none. */
export function machineTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
