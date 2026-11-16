import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const hash = text => createHash('sha256').update(text).digest('hex');
export const timestamp = () => new Date().toISOString();

export async function readText(file, fallback = '') {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function readJson(file, fallback = null) {
  const text = await readText(file);
  return text ? JSON.parse(text) : fallback;
}

// The temporary file is on the same volume. Existing files are replaced by rename;
// exclusive creation uses a hard link so a partial write never becomes visible.
export async function writeFile(file, content, exclusive = false) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temporary, 'wx');
    try { await handle.writeFile(content, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    if (exclusive) await fs.link(temporary, file);
    else await fs.rename(temporary, file);
    return true;
  } catch (error) {
    if (exclusive && error.code === 'EEXIST') return false;
    throw error;
  } finally { await fs.unlink(temporary).catch(() => {}); }
}

export const writeJson = (file, value, exclusive = false) => writeFile(file, JSON.stringify(value, null, 2) + '\n', exclusive);

export async function listJson(directory) {
  const names = await fs.readdir(directory);
  const records = [];
  for (const name of names.filter(name => name.endsWith('.json')).sort()) {
    records.push(await readJson(path.join(directory, name)));
  }
  return records;
}

export async function markdownFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(file));
    else if (entry.name.endsWith('.md')) files.push(file);
  }
  return files.sort();
}

export function parseNote(text) {
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('卡片缺少 YAML 属性');
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const property = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (!property) continue;
    let value = property[2];
    if (value.startsWith('"')) value = JSON.parse(value);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/''/g, "'");
    fields[property[1]] = String(value);
  }
  return { fields, body: match[2] };
}

export function renderNote(fields, body) {
  return `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(String(value))}`).join('\n')}\n---\n${body}`;
}

export async function acquireLock(directory) {
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, 'process.lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(file, 'wx');
      await handle.writeFile(String(process.pid));
      await handle.close();
      return async () => { await fs.unlink(file).catch(() => {}); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const pid = Number(await readText(file));
      let alive = true;
      try { process.kill(pid, 0); } catch (probe) { alive = probe.code !== 'ESRCH'; }
      if (!pid || alive) throw new Error('已有服务正在使用此状态目录，或 process.lock 需要检查');
      await fs.unlink(file).catch(() => {});
    }
  }
  throw new Error('无法取得运行锁');
}
