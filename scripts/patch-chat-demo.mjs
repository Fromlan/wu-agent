import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const adapters = path.join(import.meta.dirname, 'chat-demo');
await fs.copyFile(path.join(adapters, 'workspace.ts'), path.join(root, 'src/app/workspace.ts'));
for (const file of ['WorkbenchNav.tsx', 'WorkbenchNav.module.css']) {
  await fs.copyFile(path.join(adapters, file), path.join(root, 'src/components/sider', file));
}
async function edit(file, replacements) {
  const target = path.join(root, file);
  let source = await fs.readFile(target, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) throw new Error('Upstream source changed: ' + file);
    source = source.replace(before, () => after);
  }
  await fs.writeFile(target, source);
}

await edit('rspack.config.ts', [
  ['export default defineConfig(createConfig())', "export default defineConfig(createConfig({ apiOrigin: '/api/chat-demo' }))"],
  ["patterns: [{ from: path.resolve(root, 'LICENSE'), to: 'LICENSE', toType: 'file' }],", "patterns: [\n        { from: path.resolve(root, 'LICENSE'), to: 'LICENSE', toType: 'file' },\n        { from: path.resolve(root, 'src/app/theme.css'), to: 'theme.css', toType: 'file' },\n      ],"],
]);
await edit('src/index.html', [
  ['<html lang="zh-CN">', '<html lang="zh-CN" data-wu-configured="WU_CHAT_CONFIGURED">'],
  ['<title>API 使用 demo</title>', '<title>与悟对话</title>\n    <link rel="icon" href="/favicon.ico">\n    <link rel="stylesheet" href="theme.css">'],
]);
await edit('src/main.tsx', [["import './app/theme.css'\n", '']]);
await edit('src/services/api/client.ts', [
  ['    response = await fetch(url, init)', "    const headers = new Headers(init.headers)\n    headers.delete('Authorization')\n    headers.delete('x-api-key')\n    headers.set('X-Wu-Chat', '1')\n    response = await fetch(url, { ...init, headers })"],
]);
await edit('src/services/settings.ts', [
  ["import { create } from 'zustand'", "import { create } from 'zustand'\nimport { workbenchEmbedded, workbenchSidebarKey } from '../app/workspace.js'"],
  ["  apiKey: 'chat-demo:api-key',\n", ''],
  ["  return isChineseBrowser() ? 'zh-CN' : 'en-US'", "  return 'zh-CN'"],
  ['  apiKey: read(KEYS.apiKey),', "  apiKey: document.documentElement.dataset.wuConfigured === 'yes' ? 'wu-server' : null,"],
  ['  write(KEYS.apiKey, apiKey)\n', ''],
  ["  siderCollapsed: read(KEYS.siderCollapsed) === 'true',", "  siderCollapsed: workbenchEmbedded\n    ? read(workbenchSidebarKey) === 'collapsed'\n    : read(KEYS.siderCollapsed) === 'true',"],
  ["  write(KEYS.siderCollapsed, String(siderCollapsed))", "  if (workbenchEmbedded) write(workbenchSidebarKey, siderCollapsed ? 'collapsed' : 'expanded')\n  else write(KEYS.siderCollapsed, String(siderCollapsed))"],
  ["  useSettings.setState({ siderCollapsed })\n}", `  useSettings.setState({ siderCollapsed })
}

window.addEventListener('storage', event => {
  if (event.key === KEYS.themePreference || event.key === null) {
    useSettings.setState({ themePreference: initialThemePreference() })
  }
  if (workbenchEmbedded && (event.key === workbenchSidebarKey || event.key === null)) {
    useSettings.setState({ siderCollapsed: read(workbenchSidebarKey) === 'collapsed' })
  }
})`],
]);
await edit('src/components/sider/Sider.tsx', [
  ["import { SessionItem } from './SessionItem.js'", "import { SessionItem } from './SessionItem.js'\nimport { workbenchEmbedded } from '../../app/workspace.js'\nimport { WorkbenchBrand, WorkbenchHistoryLabel, WorkbenchLinks, WorkbenchNav, useWorkbenchSummary } from './WorkbenchNav.js'"],
  ['  const t = useTranslate()\n', '  const t = useTranslate()\n  const workbench = useWorkbenchSummary(workbenchEmbedded)\n'],
  ['clsx(styles.sider, mobile && styles.mobile)', 'clsx(styles.sider, mobile && styles.mobile, workbenchEmbedded && styles.embedded)'],
  ["<div className={styles.appName}>{t('appName')}</div>", "<div className={styles.appName}>{workbenchEmbedded ? <WorkbenchBrand /> : t('appName')}</div>"],
  ['      <div className={styles.listWrap}>', '      {workbenchEmbedded ? <>\n        <WorkbenchNav summary={workbench} />\n        <WorkbenchHistoryLabel />\n      </> : null}\n      <div className={styles.listWrap}>'],
  ['      {deleting ? (', '      {workbenchEmbedded ? <WorkbenchLinks vaultUri={workbench.vaultUri} /> : null}\n      {deleting ? ('],
]);
await fs.appendFile(path.join(root, 'src/components/sider/Sider.module.css'), `

.embedded {
  width: 232px;

  .top { margin-bottom: 10px; }
  .listWrap { margin-top: 3px; }
  .bottom { height: 40px; padding: 0; }
  .settingsIcon { width: 21px; height: 24px; }

  &.mobile {
    width: 300px;
    max-width: calc(100vw - 48px);
  }
}

@media (max-height: 550px) {
  .embedded {
    overflow-y: auto;
    .listWrap { flex: 1 0 115px; }
  }
}
`);
await edit('src/components/settings/SettingsDialog.tsx', [
  ["import { useIsMobile } from '../../app/viewport.js'\n", ''],
  ["import { ApiKeyConfirm, ApiKeyField, useApiKeyEditor } from './ApiKeyField.js'\n", ''],
  ['  const isMobile = useIsMobile()\n', ''],
  ['  // 切换分组不丢失正在输入的 API Key 与导入状态\n  const apiKeyEditor = useApiKeyEditor()\n', "  const configured = useSettings((state) => Boolean(state.apiKey))\n"],
  ['<ApiKeyField editor={apiKeyEditor} />', "<p className={styles.label}>{t(configured ? 'wuServerConfigured' : 'wuServerMissingKey')}</p>"],
  ['              {isMobile ? <ApiKeyConfirm editor={apiKeyEditor} /> : null}\n', ''],
]);
await edit('src/i18n/zh.ts', [
  ["  appName: 'API 使用 demo',", "  appName: '对话记录',"],
  ["  apiKeyStart:", "  wuServerConfigured: '已连接本地服务，使用 .env 配置的 DeepSeek 密钥。',\n  wuServerMissingKey: '请在工作台项目的 .env 中设置 DEEPSEEK_API_KEY，再重启本地服务。',\n  apiKeyStart:"],
]);
await edit('src/i18n/en.ts', [
  ["  appName: 'API usage demo',", "  appName: 'Chat history',"],
  ["  apiKeyStart:", "  wuServerConfigured: 'Connected to Wu. DeepSeek credentials are read from the local .env file.',\n  wuServerMissingKey: 'Set DEEPSEEK_API_KEY in the Wu .env file, then restart the local server.',\n  apiKeyStart:"],
]);
