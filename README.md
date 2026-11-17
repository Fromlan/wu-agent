# 知识工作台 · DSH 插件

DeepSeek Harness 的本地知识工作台插件。它把「研究 → 审阅 → 入库」做成一个常驻循环：agent 查资料、写候选卡片，你在侧栏工作台或 Obsidian Bases 数据库里确认，确认后的卡片成为正式笔记。所有内容是本机 Markdown，可以直接用 Obsidian 打开。

这个仓库是原「悟 · 个人知识工作台」原型在 DSH 上的插件化版本：原型里的本地仓库、候选卡审阅、每日研究、后续问题与偏好，分别落到了 DSH 的 Markdown 仓库、槽位页面、`schedule` 服务和工具注册表里。仓库现在生成 Obsidian Bases `.base` 文件，把候选卡、正式笔记和研究简报变成可筛选、分组、排序的数据库视图。

## 位置

- **面板**：左侧面板图标列表里的书本图标「知识工作台」，与「插件」「定时任务」同一列。
- **数据库**：仓库根目录的 `知识工作台.base`，用 Obsidian 1.9+ 的 Bases 打开，含待审阅、收件箱、知识库（卡片/表格）、研究简报和全部笔记视图。
- **工具**：`knowledge_status`、`knowledge_capture`、`knowledge_search`、`knowledge_read`、`knowledge_ask`、`knowledge_brief`。
- **排程**：在「知识工作台 → 研究记录」开启每日研究，任务由 DSH 的 `schedule` 服务托管，运行在一个普通新会话里。

## 安装

用 DSH 的 **Plugins → 添加插件 → 本地目录**，选择这个仓库根目录；或在本机已安装时用：

```powershell
# 在 DSH 的 Creator/管理会话里，让 agent 执行 install_bundle
# target = 本仓库根目录的绝对路径
```

安装后插件行是 `@local/dsh-knowledge-workbench`，Host 半与浏览器半同时生效。

## 界面

整页是一屏分栏，不做整页滚动：

- **顶栏**：面板名与一句上下文（日期、待审阅/暂缓/已入库的数量），右侧是研究状态（点一下跳到研究视图）、刷新和「立即研究」。研究排队后会显示「研究已排队」，跑完自动消失。
- **标签**：收件箱 / 知识库 / 研究 / 偏好与问题，下划线样式，后面的数字是各自待处理的数量。
- **收件箱**：左侧列表逐条展示标题、摘要、日期与标签；每行右侧可直接「确认入库 / 暂缓 / 跳过」，不用先打开卡片，也不会把正在阅读的卡片切走。右侧阅读区单独滚动，确认当前卡片后自动跳到下一张待审阅卡片。
- **知识库 / 研究**：同样的左列表右阅读。知识库为空时会说明怎么用 Obsidian 打开 `知识工作台.base`；研究视图左侧是每日研究与简报列表，右侧是选中的简报。
- **偏好与问题**：左栏编辑偏好（兴趣会显示成可删除的标签），右栏管理排队问题；未保存时标题旁有提示。
- **底栏**：仓库与 `知识工作台.base` 的路径（可复制），以及当前视图的快捷键提示。

键盘：`j` / `k` 在列表中移动并打开，`a` 确认、`h` 暂缓、`s` 跳过（作用于当前焦点行或已打开的卡片），`/` 搜索，`Esc` 清除搜索或取消删除。窄屏（≤840px）下列表与阅读区切换为单栏，阅读区左上角有返回按钮。所有颜色、字号和边框都来自 DSH 主题 token，跟随浅色/深色主题；标题、简介与下划线标签也按 DSH 插件页的字号与 44px 标签条对齐。

## 循环

1. 「立即研究」或每日定时 → DSH 新建一个普通会话，agent 读取偏好与待研究问题，用 `web_search` / `web_fetch` 查原文。
2. agent 只把有逐字引文的结论写进 `inbox/`（`knowledge_capture`），并写当天 `briefs/`。
3. 你在「知识工作台 → 收件箱」读卡片，或直接打开 Obsidian Bases 的 `知识工作台.base`：确认入库、暂缓、跳过、恢复待审阅、删除，或「继续深挖」把问题加入队列。
4. 确认后卡片移动到 `library/`；删除只移走候选，不影响已入库笔记。

只有你能确认入库；agent 没有发布工具。

## Obsidian Bases 数据库

插件在 `<vault>/知识工作台.base` 生成一个 Obsidian Bases 文件，把笔记属性当作列：

| 视图 | 内容 |
| --- | --- |
| 待审阅 | `inbox/` 里 `review == "待审阅"` 的卡片，按创建日倒序，带摘要、标签和来源数 |
| 收件箱（全部） | 所有候选卡，按 `review` 分组（待审阅 / 暂缓 / 跳过 / 确认） |
| 知识库 | `library/` 的卡片视图 |
| 知识库（表格） | `library/` 的表格，带来源链接 |
| 研究简报 | `briefs/` 的每日简报，带今日重点和问题数 |
| 全部笔记 | 最近修改的 Markdown 文件，便于直接跳到源文件 |

卡片上的数据库属性由 `knowledge_capture` 写入：

- `title`、`summary`、`review`、`created`、`approved`、`tags`
- `source_count`（数字）和 `sources`（URL 列表）

`.base` 文件只在缺失时生成。**你在 Obsidian 里改过的视图、列、筛选和排序不会被插件覆盖**；删掉该文件后，下一次刷新工作台会重新生成默认版本。

## 审阅的权威来源

候选卡片就是普通 Markdown，两种确认方式等价：

1. 在侧栏「知识工作台」点「确认入库」；
2. 在 Obsidian Bases 表格（或笔记属性）里把 `review` 改成 `确认`。工作台每 15 秒刷新、手动刷新或下次 `knowledge_status` 时会扫描并发布。

确认时把**当前文件内容**移动到 `library/`，所以确认前在 Obsidian 里的编辑会一起入库。扫描只接受 frontmatter `id` 与文件名一致的候选卡，且目标已存在时不会覆盖。

## 仓库结构

```
<vault>/
  知识工作台.base   Obsidian Bases 数据库（视图、筛选、列、排序）
  inbox/           候选卡片（frontmatter 带 review: 待审阅）
  library/         确认后的正式笔记
  briefs/          每天一份研究简报
  偏好.md          兴趣 / 基础 / 目标 / 阅读习惯的镜像
  待研究.md        后续问题镜像；追加 `- 问题` 也会进队列
  .workbench/      状态、回收站、临时写入
```

默认 vault 是 `~/Documents/DSH知识库`。可以在 profile 的 `cordis.patch.yml` 里给这一行加 `config.vault` 改到别处，例如指向已有的 Obsidian 仓库：

```yaml
- id: knowledge-workbench
  name: '@local/dsh-knowledge-workbench'
  config:
    vault: 'D:\Notes\悟'
```

`config.timeZone` 可覆盖日期所用时区（默认取本机时区）。

## 实现

| 文件 | 职责 |
| --- | --- |
| `index.js` | Host 半：vault 配置、浏览器 JSON API、`schedule` 排程、工具注册 |
| `lib/store.js` | Markdown 仓库：候选卡、审阅迁移、偏好与问题镜像、简报、检索 |
| `lib/tools.js` | 六个 agent 工具（原始 JSON Schema，不依赖 DSH 内部包） |
| `lib/note.js` | frontmatter 读写、卡片渲染、日期与 note id |
| `lib/bases.js` | Obsidian Bases 文件内容与属性确认常量 |
| `lib/research.js` | 每日/立即研究的提示词与时间校验 |
| `client.js` | 浏览器半：侧栏入口 + 知识工作台整页（分栏布局、快捷键、只读主题 token） |
| `locale/` | 中英文插件标题与详情 |
| `docs/` | 插件详情页配图 |

浏览器半只调用 Host 注册的 `/plugin/dsh-knowledge-workbench` 路由；该路由校验 Host 与浏览器会话（`ctx.connection.requestRejection`），只服务本机页面。

## 验证

```powershell
node --test
```

测试覆盖仓库读写、Bases 文件生成（不覆盖用户编辑）、审阅迁移与恢复、在 Bases 里改 `review` 的确认路径、偏好与问题镜像、从 Obsidian 追加问题、简报字段、检索，以及浏览器 API 的鉴权、审阅、偏好、追问和排程请求体、六个工具的执行链路。`test/client.test.mjs` 另外守住浏览器半的界面约定：只用主题 token（含 `color-mix`，不出现字面颜色）、不引用 Harness Client 包、中英文字典键一致，并保留审阅动作、标签页与键盘操作。

UI 渲染需要在 DSH 页面里人工确认；Host 半的安装状态、工具注册、槽位注册与接口鉴权可通过 DSH 的运行时检查验证。
