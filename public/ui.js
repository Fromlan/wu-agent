export const $ = id => document.getElementById(id);

export function el(tag, className = '', ...children) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children.filter(child => child != null && child !== false));
  return element;
}

const paths = {
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  logo: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z"/><path d="M12 6.5 17.5 12 12 17.5 6.5 12 12 6.5Z"/><path d="M10 12h4m-2-2v4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-4.1a8.5 8.5 0 1 1 15.4-4.4Z"/><path d="M8 10h8m-8 4h5"/>',
  inbox: '<path d="M4 7.5 7 4h10l3 3.5 1 9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3.5 12H8l2 2.5h4l2-2.5h4.5"/>',
  book: '<path d="M12 6.5c-2-2-5-2.5-9-1.5v14c4-1 7-.5 9 1.5 2-2 5-2.5 9-1.5V5c-4-1-7-.5-9 1.5Zm0 0v14"/>',
  sliders: '<path d="M4 6h4m4 0h8M4 12h9m4 0h3M4 18h2m4 0h10"/><circle cx="10" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  vault: '<path d="m13 2 6 6 2 7-5 7-9-2-4-6 4-8 6-4Zm0 0-3 9m11 4-11-4m-3 9 3-9m-7 3 7-3"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  'arrow-up': '<path d="M12 20V5m-6 6 6-6 6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  external: '<path d="M13 5h6v6m0-6-8 8m5-1v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  spark: '<path d="M12 2c.9 6 3.9 9 10 10-6.1 1-9.1 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-1.4 5M20 4v7h-7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.5 2.5 0 1 1 3.8 2.1c-1 .6-1.3 1.1-1.3 2.1m0 3.3h.01"/>',
};

function svg(name) {
  const graphic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.65', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) graphic.setAttribute(key, value);
  // Only constant vectors in the icon table enter the SVG markup.
  graphic.innerHTML = paths[name] || '';
  return graphic;
}

export function icon(name) {
  const item = el('i');
  item.dataset.icon = name;
  item.append(svg(name));
  return item;
}

export function hydrateIcons() {
  for (const item of document.querySelectorAll('i[data-icon]')) item.replaceChildren(svg(item.dataset.icon));
}

export function link(label, href, className = 'text-action', glyph, tail) {
  const anchor = el('a', className, glyph && icon(glyph), label, tail && icon(tail));
  anchor.href = href;
  return anchor;
}

export function button(label, handler, className = 'button secondary', glyph) {
  const control = el('button', className, glyph && icon(glyph), label);
  control.type = 'button';
  control.addEventListener('click', handler);
  return control;
}

export function pill(label, tone = '') {
  const badge = el('span', 'pill', label);
  badge.dataset.tone = tone;
  return badge;
}

export function panelTitle(title, glyph, badge) {
  return el('div', 'panel-title', el('span', 'panel-icon', icon(glyph)), el('h2', '', title), badge);
}

export function empty(title, description, { glyph = 'inbox', action, center = false } = {}) {
  return el('div', 'empty' + (center ? ' center' : ''), el('span', 'empty-icon', icon(glyph)),
    el('div', '', el('h3', '', title), el('p', '', description), action));
}

function external(url, label) {
  try {
    const parsed = new URL(url);
    if (['https:', 'http:'].includes(parsed.protocol)) {
      const anchor = link(label, parsed.href, '');
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return anchor;
    }
  } catch {}
  return document.createTextNode(label);
}

function inline(parent, text) {
  const pattern = /(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>"\u3000]+|\x60[^\x60\n]+\x60|\*\*[^*\n]+\*\*)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    parent.append(text.slice(cursor, match.index));
    if (token.startsWith('[[')) parent.append(el('span', '', token.slice(2, -2).split('|').pop()));
    else if (token[0] === '[') {
      const cut = token.indexOf('](');
      parent.append(external(token.slice(cut + 2, -1), token.slice(1, cut)));
    } else if (token[0] === '*') parent.append(el('strong', '', token.slice(2, -2)));
    else if (token.codePointAt(0) === 96) parent.append(el('code', '', token.slice(1, -1)));
    else {
      const url = token.replace(/[，。？！；、,.!?;:]+$/, '');
      parent.append(external(url, url), token.slice(url.length));
    }
    cursor = match.index + token.length;
  }
  parent.append(text.slice(cursor));
  return parent;
}

// A text-first Markdown reader for notes and model output; raw HTML stays text.
export function markdown(input, { omitTitle = false } = {}) {
  const fragment = document.createDocumentFragment();
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  let claim = false;
  let first = true;
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      if (!(first && omitTitle && heading[1].length === 1)) fragment.append(inline(el('h' + Math.min(4, Math.max(2, heading[1].length))), heading[2]));
      claim = heading[2] === '核心结论'; i++;
    } else if (/^\x60{3}/.test(line)) {
      const code = [];
      for (i++; i < lines.length && !/^\x60{3}/.test(lines[i].trim()); i++) code.push(lines[i]);
      if (i < lines.length) i++;
      fragment.append(el('pre', '', el('code', '', code.join('\n'))));
    } else if (/^>/.test(line)) {
      const quote = [];
      for (; i < lines.length && /^>/.test(lines[i].trim()); i++) quote.push(lines[i].trim().replace(/^>\s?/, ''));
      fragment.append(inline(el('blockquote'), quote.join('\n')));
    } else if (/^([-*+]\s+|\d+[.)]\s+)/.test(line)) {
      const ordered = /^\d/.test(line);
      const match = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      const list = el(ordered ? 'ol' : 'ul');
      for (; i < lines.length && match.test(lines[i]); i++) list.append(inline(el('li'), lines[i].replace(match, '')));
      fragment.append(list);
    } else if (/^---+$/.test(line)) {
      fragment.append(el('hr')); i++;
    } else {
      fragment.append(inline(el('p', claim ? 'claim' : ''), line)); i++;
    }
    first = false;
  }
  return fragment;
}

