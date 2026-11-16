import fs from 'node:fs/promises';
import path from 'node:path';

const [sourceArgument, destinationArgument, revision] = process.argv.slice(2);
const project = await fs.realpath(path.resolve(import.meta.dirname, '..'));
const source = await fs.realpath(sourceArgument);
const destination = path.join(project, 'public', 'chat-demo');
const buildRelative = path.relative(path.join(project, '.wu-agent', 'chat-demo-build'), source);
if (!/^[a-f0-9]{40}$/.test(revision) || path.resolve(destinationArgument) !== destination
  || buildRelative === '' || buildRelative.startsWith('..') || path.isAbsolute(buildRelative)) {
  throw new Error('Chat Demo packaging paths are outside the expected build folders');
}
const dist = path.join(source, 'dist');
const packages = path.join(source, 'node_modules', '.pnpm');
const notices = new Map();
for (const entry of await fs.readdir(packages, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(packages, entry.name, 'node_modules');
  const name = entry.name.split('@', entry.name.startsWith('@') ? 2 : 1).join('@').replace('+', '/');
  const pkgRoot = path.join(directory, name);
  const metadata = await fs.readFile(path.join(pkgRoot, 'package.json'), 'utf8').catch(() => null);
  if (!metadata) continue;
  const { name: pkg, version, license } = JSON.parse(metadata);
  const titles = (await fs.readdir(pkgRoot)).filter(file => /^(?:licen[cs]e|copying|notice)(?:[._-]\w+)?$/i.test(file));
  const contents = await Promise.all(titles.map(file => fs.readFile(path.join(pkgRoot, file), 'utf8').catch(() => '')));
  notices.set(pkg + '@' + version, [license || '', ...contents].join('\n'));
}
const sorted = [...notices].sort(([a], [b]) => a.localeCompare(b));
await fs.writeFile(path.join(dist, 'THIRD_PARTY_NOTICES.txt'),
  'DeepSeek Chat Demo and its build dependencies\n'
  + 'https://github.com/deepseek-ai/chat-demo/tree/' + revision + '\n\n'
  + sorted.map(([name, body]) => name + '\n' + body.trim() + '\n').join('\n'));
await fs.writeFile(path.join(dist, 'UPSTREAM.txt'), 'https://github.com/deepseek-ai/chat-demo/tree/' + revision + '\n');
const oldOutput = path.join(source, 'previous-output');
const existing = await fs.lstat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; });
if (existing) {
  if (!existing.isDirectory() || existing.isSymbolicLink()
    || !(await fs.readFile(path.join(destination, 'UPSTREAM.txt'), 'utf8')).startsWith('https://github.com/deepseek-ai/chat-demo/tree/')) {
    throw new Error('Refusing to overwrite an unrelated public/chat-demo directory');
  }
  await fs.rename(destination, oldOutput);
}
try { await fs.rename(dist, destination); }
catch (error) {
  if (existing) await fs.rename(oldOutput, destination);
  throw error;
}
if (existing) await fs.rm(oldOutput, { recursive: true, force: true });
console.log('Chat Demo packaged:', destination);
