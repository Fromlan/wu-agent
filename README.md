# 悟 · 个人知识工作台

DeepSeek 驱动的本地知识助手。主动询问兴趣与习惯，每天查阅资料生成知识卡片，在 Obsidian 确认后发布到永久知识库。使用 Node.js 内置 HTTP、文件和定时器能力，零运行依赖。

## 启动

需要 Node.js 22.12 或更新版本。

1. 将 `.env.example` 复制为 `.env`，填入自己的 `DEEPSEEK_API_KEY`。密钥只由本地服务读取。
2. Windows 下双击项目根目录的 `start.cmd`。脚本检查 Node.js 版本，缺少 `.env` 时从示例创建，服务就绪后自动打开浏览器。保持启动窗口打开，按 `Ctrl+C` 停止服务。启动失败时窗口会保留错误信息。
3. 在「今日工作台」点「设置研究主题」，或在「研究追问与旧对话」告诉悟你的兴趣、基础与阅读习惯。默认地址为 <http://127.0.0.1:4317>，修改 `PORT` 后会打开对应地址。已有服务运行时，先在原启动窗口按 `Ctrl+C`，再重新打开 `start.cmd` 加载新版。
4. 在 Obsidian 选择「打开本地仓库」，打开项目下的 `vault` 文件夹。首次启动服务会创建它。
5. 在「今日工作台」点「立即研究」，或等待设定时间。当天第一轮也算作当日的定时研究，完成后可手动再跑一轮。各轮进度、简报和后续问题都在「研究收件箱 → 研究记录」。
6. 在「研究收件箱」点开卡片阅读结论与原文证据。点「在 Obsidian 审阅」，将候选笔记的 `review` 设为 `确认`。服务发布后，「我的知识库」会出现正式笔记，支持搜索标题与正文。`暂缓` 和 `跳过` 可在收件箱筛选。点详情里的「删除候选」，可将候选文件移到 Vault 的 `.trash/wu-agent/`，正式笔记仍保存在知识库。

候选卡的「继续深挖」可提交一个具体问题。它会出现在「研究偏好 → 后续研究」，按加入顺序被研究选中。该轮生成卡片并交付后，问题从队列移除；证据不足或失败会保留。收藏和继续深挖是两个操作。

服务运行时，关闭浏览器或 Obsidian 仍可研究。退出服务后定时任务暂停，重新启动会恢复未完成任务，并在当天已过交付时间时补跑当天任务。日期按配置时区计算。多日离线后只生成当天的一份日报。

终端启动可使用 `node src/server.mjs`。运行 `start.cmd --no-open` 可启动服务并省略浏览器打开步骤。

## 完整对话

导航中的「与悟对话」接入了 DeepSeek 官方 Chat Demo。支持多会话、重命名与删除，编辑提问、重新生成和切换回答版本，流式回复、停止和续写、深度思考、智能搜索、读取链接及引用来源。回复渲染支持 Markdown 表格、任务列表、代码高亮、KaTeX 公式和 Mermaid 图表。输入区支持上传、粘贴与拖放附件，允许麦克风后可以语音输入，并可朗读回复。

设置提供中英文、主题、地区与音色，以及 ZIP 历史导入和导出。新会话保存在当前浏览器的 IndexedDB，内嵌界面和同地址的独立窗口共用会话。历史导入按 Chat Demo 的行为，确认后替换当前浏览器中的完整对话。研究追问及此前用悟生成的对话可以在「研究追问与旧对话」打开，继续记录在 `.wu-agent/sessions/`。

完整对话使用 DeepSeek 的 `deepseek-flash`。本地服务使用 `.env` 的密钥转发聊天、附件和语音请求，并在聊天请求中带上研究偏好和匹配的已收录笔记。需要相应的 DeepSeek 接口权限与余额。

已构建的 Chat Demo 随项目提供，启动时由 Node 直接读取。修改上游适配时，用 PowerShell 运行 `./scripts/build-chat-demo.ps1`（需要 pnpm）。脚本按固定 GitHub 提交构建 `public/chat-demo/`，该目录包含 MIT 许可证和依赖许可声明。

## 配置

修改 `.env` 后重启。默认 Vault 位于项目内，定时研究默认每天 Asia/Shanghai 时间 09:00 运行。每轮最多 3 张卡、3 个搜索词和 4 次来源抓取。可以修改 `VAULT_PATH`、`DAILY_AT`、`TIMEZONE`、`DAILY_CARD_LIMIT`、`RESEARCH_QUERY_LIMIT`、`RESEARCH_SOURCE_LIMIT`。工作台中的「研究偏好」可直接修改兴趣、基础、目标、阅读习惯和希望减少的内容。也可以设置每日时间（优先于 `.env` 的默认值）与暂停自动研究；手动研究仍可用。

DeepSeek 使用 `deepseek-flash` 和 Messages API。研究使用独立 Search / Fetch 接口，原文按来源保留在运行记录中。需要具有这些接口使用权限及余额的 DeepSeek API Key。对话、相关偏好、匹配到的知识卡和研究材料会随相应请求提交给 DeepSeek。

## 文件与恢复

| 位置 | 内容 |
| --- | --- |
| `vault/Agent/规则.md` | 每次任务读取的协作规则 |
| `vault/Agent/偏好.md` | 用户可编辑的偏好笔记，Agent 提取的偏好有单独标记段 |
| `vault/Agent/待研究.md` | 可手工追加的问题，研究时会读入 |
| `vault/每日审阅/` | 当日简报与候选卡片 |
| `vault/知识库/` | 用户确认后发布的 Markdown 笔记 |
| `.wu-agent/events/` | 持久事件及 pending / running / done / failed 状态 |
| `.wu-agent/runs/` | 研究计划、查询、抓取正文和卡片检查点 |
| `.wu-agent/sessions/` | 聊天记录和完整模型响应 |
| `.wu-agent/outbox/` | 浏览器收到的提问、日报和发布结果 |
| `.wu-agent/profile.json` | 明确提供的研究偏好和交付设置 |
| `.wu-agent/followups/` | 用户添加、移除和研究完成的后续问题 |
| `.wu-agent/receipts/` | 被确认版本的内容哈希及发布记录 |

每个事件一个 JSON 文件，使用同卷临时文件加 rename 或 hard link 提交。单进程锁保证同一个状态目录只由一个服务执行。研究在计划、每次搜索、每次抓取、卡片生成、交付之间保存检查点。用户回复和审阅事件优先于下一步研究。网络失败有限重试，最终失败显示在界面，可手动重试。

候选卡的 `id` 和 `version` 用于关联运行记录，请保留。确认事件保存用户确认时的完整内容，发布前检查内容是否变化。相同卡片的相同确认重试会复用已发布结果。已发布后修改候选卡会提示冲突，用户可以直接在 Obsidian 编辑正式笔记。

模型输出的引文必须能在实际抓取的正文中匹配。这个检查验证出处和摘录一致性，结论是否被证据充分支持仍需要审阅。每轮研究有独立的计划和简报，失败可从界面重试。配置的查询数和来源数约束一个已保存的计划，网络中断或崩溃可能重试尚未保存响应的请求并再次计费。

研究追问采用异步排队及状态刷新，已有上下文按最近对话、偏好、任务问题和相关知识加载。用「回复追问」发送的消息会带上原问题，即使它来自先前的日报。用户未回复时其他任务仍可运行。研究历史的后续建议会提供给下一次计划；显式加入待研究的问题会优先处理。

## 验证

执行 `node --test`。测试使用本地 HTTP 服务模拟 DeepSeek API，覆盖流式对话、附件上传、语音接口、研究恢复、时区调度、失败重试、后续问题、追问上下文和知识库搜索。实际 API 连通性需配置有效 Key 后验证。

配置 Key 后，执行 `node scripts/live-smoke.mjs` 可运行真实接口验收。该脚本在 `.wu-agent/live-smoke-*` 下创建独立的状态和 Vault，执行一次对话、一个搜索词、一次网页抓取和最多一张卡片生成，再通过修改测试笔记的 `review` 属性验证发布。它会产生 DeepSeek API 用量，生成的卡片留在测试目录供检查。

## 参考

- [DeepSeek 构建 Chatbot](https://api-docs.deepseek.com/zh-cn/guides/build_a_chatbot/)
- [DeepSeek chat-demo](https://github.com/deepseek-ai/chat-demo)
- [DeepSeek Search / Fetch](https://api-docs.deepseek.com/zh-cn/guides/search/)
- [Building always-on agents](https://claude.com/resources/articles/building-always-on-agents)

工作台和本地运行器为项目实现，完整对话集成官方 Chat Demo。API 用法和事件驱动结构参考上述资料。
