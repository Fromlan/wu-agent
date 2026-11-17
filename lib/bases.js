/**
 * The Obsidian Bases file that turns the vault into a database.
 *
 * Obsidian 1.9+ treats a `.base` file as a YAML view over note properties:
 * `filters` choose files, `order` chooses columns, `sort` orders rows, and
 * `properties` gives the columns Chinese headers. The file is seeded only when
 * missing so edits made in Obsidian survive plugin restarts.
 */

/** File name of the generated database, relative to the vault root. */
export const BASE_FILE = '知识工作台.base';

/** The frontmatter value a person sets in Obsidian to publish a card. */
export const CONFIRM_REVIEW = '确认';

/**
 * Render the base document: one file with a review queue, the inbox grouped by
 * state, the library as cards and as a table, and the research briefs.
 * @returns {string} YAML text for a `.base` file.
 */
export function baseDocument() {
  return `# 悟 · 知识工作台数据库（Obsidian Bases）
# 由 DSH 知识工作台插件生成。这个文件只在缺失时重建；你可以在 Obsidian 里
# 自由增删视图、列和排序，插件的审阅与发布不受影响。
formulas:
  noteLink: 'file.asLink(note.title)'
properties:
  formula.noteLink:
    displayName: 笔记
  note.title:
    displayName: 标题
  note.summary:
    displayName: 一句话
  note.card_type:
    displayName: 知识类型
  note.question:
    displayName: 研究问题
  note.review:
    displayName: 状态
  note.created:
    displayName: 创建
  note.approved:
    displayName: 入库
  note.tags:
    displayName: 标签
  note.source_count:
    displayName: 来源数
  note.sources:
    displayName: 来源
  note.focus:
    displayName: 今日重点
  note.date:
    displayName: 日期
  note.question_count:
    displayName: 问题数
  file.name:
    displayName: 文件名
  file.folder:
    displayName: 目录
  file.mtime:
    displayName: 修改时间
views:
  - type: table
    name: 待审阅
    filters:
      and:
        - file.inFolder("inbox")
        - 'note.review == "待审阅"'
    order:
      - formula.noteLink
      - note.summary
      - note.created
      - note.tags
      - note.source_count
    sort:
      - property: note.created
        direction: DESC
    columnSize:
      formula.noteLink: 220
      note.summary: 420
      note.tags: 160
      note.source_count: 80
    summaries:
      note.source_count: Sum
  - type: table
    name: 收件箱（全部）
    filters:
      and:
        - file.inFolder("inbox")
    groupBy:
      property: note.review
      direction: ASC
    groupOrder:
      - 待审阅
      - 暂缓
      - 跳过
      - 确认
    order:
      - formula.noteLink
      - note.review
      - note.summary
      - note.created
      - note.tags
      - note.source_count
    sort:
      - property: note.created
        direction: DESC
    columnSize:
      formula.noteLink: 220
      note.summary: 380
      note.tags: 160
      note.source_count: 80
  - type: cards
    name: 知识库
    filters:
      and:
        - file.inFolder("library")
    order:
      - note.summary
      - note.tags
      - note.created
    sort:
      - property: note.approved
        direction: DESC
    cardSize: 240
  - type: table
    name: 知识库（表格）
    filters:
      and:
        - file.inFolder("library")
    order:
      - formula.noteLink
      - note.summary
      - note.tags
      - note.created
      - note.approved
      - note.sources
    sort:
      - property: note.approved
        direction: DESC
    columnSize:
      formula.noteLink: 220
      note.summary: 460
      note.tags: 180
      note.sources: 240
  - type: table
    name: 研究简报
    filters:
      and:
        - file.inFolder("briefs")
    order:
      - file.name
      - note.date
      - note.focus
      - note.question_count
    sort:
      - property: note.date
        direction: DESC
    columnSize:
      note.focus: 420
      note.question_count: 90
  - type: table
    name: 全部笔记
    filters:
      and:
        - file.ext == "md"
    order:
      - formula.noteLink
      - note.review
      - note.tags
      - file.folder
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
    limit: 100
`;
}
