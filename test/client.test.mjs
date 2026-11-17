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
