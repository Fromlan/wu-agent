import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig() {
  const envFile = path.join(projectRoot, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const integer = (name, fallback, min, max) => {
    const value = Number(process.env[name] || fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} 应在 ${min}–${max} 之间`);
    return value;
  };
  const dailyAt = process.env.DAILY_AT || '09:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyAt)) throw new Error('DAILY_AT 应为 HH:mm');
  const timezone = process.env.TIMEZONE || 'Asia/Shanghai';
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date());
  return {
    root: projectRoot,
    stateDir: path.resolve(projectRoot, process.env.STATE_PATH || '.wu-agent'),
    vault: path.resolve(projectRoot, process.env.VAULT_PATH || 'vault'),
    key: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
    apiBase: 'https://api.deepseek.com',
    port: integer('PORT', 4317, 1024, 65535),
    dailyAt, timezone,
    cardLimit: integer('DAILY_CARD_LIMIT', 3, 1, 5),
    queryLimit: integer('RESEARCH_QUERY_LIMIT', 3, 1, 6),
    sourceLimit: integer('RESEARCH_SOURCE_LIMIT', 4, 1, 8),
  };
}

export function localClock(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}
