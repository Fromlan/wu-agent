/**
 * Static contracts for the browser half.
 *
 * `client.js` cannot be imported without the Harness page (it registers a
 * module factory against `window.__ModuleLoader__` and takes React from the
 * page), so these tests hold the parts that must not drift: theme-token-only
 * styling, no Harness Client imports, both locale dictionaries, and the
 * review/keyboard affordances the panel promises.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../client.js', import.meta.url), 'utf8');

function dictionaryKeys(name, nextName) {
  const start = source.indexOf(`const ${name} = {`);
  const end = source.indexOf(`const ${nextName}`, start);
  assert.notEqual(start, -1, `${name} dictionary is missing`);
  assert.notEqual(end, -1, `${nextName} dictionary is missing`);
  const block = source.slice(start, end);
  return new Set([...block.matchAll(/^ {6}([A-Za-z0-9]+):/gm)].map(match => match[1]));
}

test('browser half styles itself with theme tokens only', () => {
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, 'literal hex color');
  assert.doesNotMatch(source, /\brgba?\(/, 'literal rgb color');
  assert.doesNotMatch(source, /\bhsla?\(/, 'literal hsl color');
  const tokens = new Set([...source.matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]));
  const foreign = [...tokens].filter(token => !token.startsWith('--dsw-alias-') && !token.startsWith('--kbw-'));
  assert.deepEqual(foreign, [], 'tokens outside the alias theme and the panel-local aliases');
});

test('browser half does not import Harness Client packages', () => {
  assert.doesNotMatch(source, /@deepseek-ai\//, 'Harness package reference');
  assert.doesNotMatch(source, /^\s*import\s/m, 'module import');
  const requires = [...source.matchAll(/require\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual(requires, ['react']);
});

test('zh and en dictionaries carry the same copy', () => {
  const zh = dictionaryKeys('zh', 'en');
  const en = dictionaryKeys('en', 'REVIEW_LABEL');
  assert.ok(zh.size > 100, `unexpectedly small zh dictionary: ${zh.size}`);
  assert.deepEqual([...zh].sort(), [...en].sort());
});

test('the panel keeps its review actions, tabs, and keyboard affordances', () => {
  for (const needle of [
    "act('review'",
    "'approvedToast'",
    "save-prompt",
    "sync-prompt",
    "research.needsPromptSync",
    "kbw-prompt-input",
    "role: 'tablist'",
    "role: 'switch'",
    "'aria-selected': tab === id",
    "event.key === 'j'",
    "event.key === 'k'",
    "event.key === 'a'",
    "event.key === '/'",
    "'data-focused'",
    "reviewLock.current",
  ]) {
    assert.ok(source.includes(needle), `missing ${needle}`);
  }
});

// Exercise the actual renderer with a small React element recorder. This checks
// behavior without a DSH installation; it does not replace live visual QA.
function renderer() {
  const React = {
    Fragment: 'fragment',
    createElement(type, props, ...children) {
      const value = { ...(props || {}), children: children.flat(Infinity) };
      return typeof type === 'function' ? type(value) : { type, props: value };
    },
  };
  const context = vm.createContext({ React, h: React.createElement, zh: { tableLabel: '比较表格' } });
  const start = source.indexOf('    function inlineNodes(');
  const end = source.indexOf('    function WorkbenchPage(', start);
  vm.runInContext(`${source.slice(start, end)}\nglobalThis.render = Markdown;`, context);
  return context.render;
}

function elements(node, type) {
  if (!node || typeof node !== 'object') return [];
  return [...(node.type === type ? [node] : []), ...(node.props?.children || []).flatMap(child => elements(child, type))];
}

test('article tables scroll independently and preserve escaped pipes as one cell', () => {
  const tree = renderer()({ text: '| 维度 | A | B |\n| --- | --- | --- |\n| 条件 | 一 \\| 二 | 三 |', tableLabel: '共同维度比较' });
  const region = elements(tree, 'div').find(node => node.props.role === 'region');
  assert.equal(region.props.tabIndex, 0);
  assert.equal(region.props['aria-label'], '共同维度比较');
  assert.equal(elements(tree, 'table').length, 1);
  const cells = elements(tree, 'td');
  assert.equal(cells.length, 3);
  assert.equal(cells[1].props.children.join(''), '一 | 二');
});

test('sources and author review fold while uncertainty remains in the article', () => {
  const tree = renderer()({ text: '## 证据与不确定性\n\n尚未实测。\n\n## 审读记录\n\n修订了一处过度推断。\n\n## 来源\n\n[原文](https://example.com/source)' });
  assert.equal(elements(tree, 'details').length, 2);
  assert.equal(elements(tree, 'h2').length, 1);
  assert.equal(elements(tree, 'h2')[0].props.children.join(''), '证据与不确定性');
  assert.deepEqual(elements(tree, 'summary').map(node => node.props.children.join('')), ['审读记录', '来源']);
  assert.equal(elements(tree, 'a')[0].props.href, 'https://example.com/source');
});

test('folded sections preserve fenced text and stop at the next article section', () => {
  const tree = renderer()({ text: '## 来源\n\n```text\n## 这是代码\n```\n\n## 边界与取舍\n\n条件尚未确定。' });
  assert.equal(elements(tree, 'details').length, 1);
  assert.equal(elements(tree, 'code')[0].props.children.join(''), '## 这是代码');
  assert.equal(elements(tree, 'h2')[0].props.children.join(''), '边界与取舍');
});

test('reading removes a duplicate title after frontmatter whitespace but preserves other headings', () => {
  const start = source.indexOf('    function stripLeadingTitle(');
  const end = source.indexOf('    function statusOf(', start);
  const strip = vm.runInNewContext(`${source.slice(start, end)}\nstripLeadingTitle`);
  assert.equal(strip('\n\n# 概念标题\n\n正文', '概念标题'), '\n正文');
  assert.equal(strip('\n# 其他标题\n正文', '概念标题'), '\n# 其他标题\n正文');
  assert.equal(strip('\n\n', '概念标题'), '\n\n');
});
