/**
 * Agent-facing knowledge tools.
 *
 * These definitions use the registry's raw JSON Schema shape (not the
 * authoring DSL that first-party packages compile with `defineTool`), so this
 * bundle needs no import from the DSH installation.
 */

/** Bound a short schema description. */
const str = description => ({ type: 'string', description });
const int = description => ({ type: 'integer', description });
const bool = description => ({ type: 'boolean', description });
const arr = (items, description) => ({ type: 'array', items, description });

/** Compose one closed object schema, omitting `required` when empty. */
function obj(properties, required, description) {
  return {
    type: 'object',
    properties,
    ...(required && required.length ? { required } : {}),
    additionalProperties: false,
    ...(description ? { description } : {}),
  };
}

/** Text-only output renderer: the model sees this instead of raw JSON. */
const renderText = show => ({ render: (_args, value) => [{ type: 'text', text: show(value) }] });

/** Render one bounded line list. */
const lines = list => list.filter(line => line !== undefined && line !== null && line !== '').join('\n');

/**
 * Build the six knowledge tool definitions for one store. Exported so tests
 * can execute them without a Cordis context.
 * @param {import('./store.js').KnowledgeStore} store - vault store.
 * @returns {object[]} registry-ready tool definitions.
 */
export function createToolDefinitions(store) {
  return [
    statusTool(store),
    captureTool(store),
    searchTool(store),
    readTool(store),
    askTool(store),
    briefTool(store),
  ];
}

/**
 * Register the knowledge tools on the root tools registry.
 * @param {object} ctx - plugin context.
 * @param {import('./store.js').KnowledgeStore} store - vault store.
 */
export function registerTools(ctx, store) {
  ctx.inject(['tools'], scope => {
    const tools = scope.tools;
    scope.effect(() => {
      const disposers = createToolDefinitions(store).map(definition => tools.register(definition));
      return () => {
        for (const dispose of disposers.reverse()) dispose();
      };
    }, 'knowledge-workbench: agent tools');
  });
}

/** One pending card row in the status payload. */
const cardRow = obj({
  id: str('Card id.'),
  title: str('Card title.'),
  excerpt: str('One-line conclusion.'),
  created: str('Creation date.'),
}, ['id', 'title', 'excerpt', 'created']);

/** The `knowledge_status` tool. */
function statusTool(store) {
  return {
    name: 'knowledge_status',
    description: 'Read the user\'s knowledge workbench: inbox candidates awaiting review, library size, queued research questions, preferences, and recent research briefs. Call this first in a research round, or before answering questions about the user\'s own knowledge base. Publishing a card is a user-only action in the workbench; this tool cannot publish.',
    parameters: obj({}),
    output: {
      schema: obj({
        vault: str('Absolute vault directory.'),
        date: str('Today in the vault time zone.'),
        initialized: bool('Whether the vault skeleton exists.'),
        researchEnabled: bool('Whether a daily research task is configured.'),
        counts: obj({
          inbox: int('Candidate cards.'),
          pending: int('Cards waiting for review.'),
          library: int('Published notes.'),
          followups: int('Queued questions.'),
        }, ['inbox', 'pending', 'library', 'followups']),
        pending: arr(cardRow, 'Cards waiting for review, newest first.'),
        followups: arr(obj({
          id: str('Question id.'),
          question: str('The question.'),
        }, ['id', 'question']), 'Queued research questions, oldest first.'),
        preferences: obj({
          topics: arr(str('Topic.'), 'Interest topics.'),
          level: str('Current level.'),
          goal: str('Learning goal.'),
          style: str('Reading preference.'),
          avoid: str('What to avoid.'),
        }, ['topics', 'level', 'goal', 'style', 'avoid']),
        recentBriefs: arr(obj({
          date: str('Brief date.'),
          focus: str('That day\'s focus.'),
        }, ['date', 'focus']), 'Most recent briefs.'),
        paths: obj({
          inbox: str('Inbox directory.'),
          library: str('Library directory.'),
          briefs: str('Brief directory.'),
          base: str('Obsidian Bases file.'),
        }, ['inbox', 'library', 'briefs', 'base']),
      }, ['vault', 'date', 'initialized', 'researchEnabled', 'counts', 'pending', 'followups', 'preferences', 'recentBriefs', 'paths']),
      ...renderText(value => lines([
        `知识工作台：${value.vault}`,
        value.initialized ? '' : '仓库尚未初始化：请用户在侧栏「知识工作台」点「初始化」，或先写入第一张卡片。',
        `${value.date} · 待审阅 ${value.counts.pending} · 知识库 ${value.counts.library} · 队列 ${value.counts.followups} · 每日研究${value.researchEnabled ? '已开启' : '未开启'}`,
        `Obsidian 数据库：${value.paths.base}`,
        value.preferences.topics.length ? `兴趣：${value.preferences.topics.join('、')}` : '兴趣：尚未设置',
        value.preferences.goal ? `目标：${value.preferences.goal}` : '',
        value.preferences.style ? `阅读习惯：${value.preferences.style}` : '',
        value.preferences.avoid ? `减少推荐：${value.preferences.avoid}` : '',
        value.pending.length ? `\n待审阅卡片：\n${value.pending.map(card => `- ${card.title}（${card.id}）`).join('\n')}` : '待审阅卡片：无',
        value.followups.length ? `\n研究队列：\n${value.followups.map(item => `- ${item.question}（${item.id}）`).join('\n')}` : '研究队列：空',
        value.recentBriefs.length ? `最近简报：${value.recentBriefs.map(brief => brief.date).join('、')}` : '',
        `确认入库只能由用户在「知识工作台」完成，或在 Obsidian Bases 里把 review 改成「确认」。`,
      ])),
    },
    async execute() {
      const status = await store.status();
      const state = await store.readState();
      return {
        vault: status.vault,
        date: status.date,
        initialized: status.initialized,
        researchEnabled: Boolean(state.researchScheduleId),
        counts: {
          inbox: status.counts.inbox,
          pending: status.counts.pending,
          library: status.counts.library,
          followups: status.counts.followups,
        },
        pending: status.cards.filter(card => card.review === '待审阅').slice(0, 12)
          .map(card => ({ id: card.id, title: card.title, excerpt: card.excerpt, created: card.created })),
        followups: status.followups.slice(0, 12).map(item => ({ id: item.id, question: item.question })),
        preferences: {
          topics: Array.isArray(status.preferences.topics) ? status.preferences.topics : [],
          level: String(status.preferences.level || ''),
          goal: String(status.preferences.goal || ''),
          style: String(status.preferences.style || ''),
          avoid: String(status.preferences.avoid || ''),
        },
        recentBriefs: status.briefs.slice(0, 5).map(brief => ({ date: brief.date, focus: brief.focus })),
        paths: {
          inbox: status.paths.inbox,
          library: status.paths.library,
          briefs: status.paths.briefs,
          base: status.paths.base,
        },
      };
    },
    presentCall(args) {
      return { card: 'generic', title: 'Read knowledge workbench', kind: 'other', rawInput: args };
    },
  };
}

/** The `knowledge_capture` tool. */
function captureTool(store) {
  return {
    name: 'knowledge_capture',
    description: 'Write one reusable conclusion as a candidate knowledge card in the user\'s inbox. Requires at least one source URL and a verbatim quote from that source; the card waits for the user to approve it in the knowledge workbench or in the Obsidian Bases review table, and never enters the library automatically.',
    parameters: obj({
      title: str('Short card title, at most 120 characters.'),
      claim: str('The one reusable conclusion, at most 1000 characters.'),
      explanation: str('What it means and how to apply it, at most 4000 characters.'),
      limits: str('Conditions, counterexamples, or limits of the conclusion.'),
      sources: arr(obj({
        url: str('http(s) URL that was actually fetched.'),
        title: str('Page title.'),
        quote: str('Verbatim excerpt from the page, at least 8 characters.'),
      }, ['url', 'quote']), 'One to five fetched sources. A quote must be copied verbatim from that page.'),
      tags: arr(str('Tag.'), 'Optional tags, at most six.'),
    }, ['title', 'claim', 'explanation', 'limits', 'sources']),
    output: {
      schema: obj({
        id: str('New card id.'),
        title: str('Stored title.'),
        path: str('Vault-relative path.'),
        review: str('Review state.'),
      }, ['id', 'title', 'path', 'review']),
      ...renderText(value => `候选卡片已写入收件箱：《${value.title}》（${value.id}，${value.review}）。路径 ${value.path}。它不会自动入库，等用户在知识工作台确认。`),
    },
    async execute(args) {
      return store.createCard(args || {});
    },
    presentCall(args) {
      return { card: 'generic', title: 'Capture knowledge card', kind: 'edit', rawInput: { title: args && args.title } };
    },
  };
}

/** The `knowledge_search` tool. */
function searchTool(store) {
  return {
    name: 'knowledge_search',
    description: 'Search the user\'s knowledge base and review inbox. Use it to reuse what the user already collected before researching, or to answer a question about their notes.',
    parameters: obj({
      query: str('Words to match against titles and bodies.'),
      scope: { type: 'string', enum: ['all', 'library', 'inbox'], description: 'Which area to search. Defaults to all.' },
      limit: int('Maximum matches, 1 through 20. Defaults to 8.'),
    }, ['query']),
    output: {
      schema: obj({
        query: str('The searched text.'),
        matches: arr(obj({
          scope: str('inbox or library.'),
          id: str('Card or note id.'),
          title: str('Title.'),
          excerpt: str('One-line summary.'),
          review: str('Review state.'),
          path: str('Vault-relative path.'),
        }, ['scope', 'id', 'title', 'excerpt', 'review', 'path']), 'Ranked matches.'),
      }, ['query', 'matches']),
      ...renderText(value => lines([
        `搜索「${value.query}」：${value.matches.length} 条`,
        ...value.matches.map(match => `- [${match.scope === 'library' ? '知识库' : '收件箱'}] ${match.title}（${match.id}）${match.excerpt ? ` — ${match.excerpt}` : ''}`),
      ])),
    },
    async execute(args) {
      const query = String((args && args.query) || '');
      const matches = await store.search({
        query,
        scope: (args && args.scope) || 'all',
        limit: (args && args.limit) || 8,
      });
      return { query, matches };
    },
    presentCall(args) {
      return { card: 'generic', title: 'Search knowledge', kind: 'search', rawInput: { query: args && args.query } };
    },
  };
}

/** The `knowledge_read` tool. */
function readTool(store) {
  return {
    name: 'knowledge_read',
    description: 'Read one knowledge card in full by the id returned from knowledge_search or knowledge_status. Use it before citing or extending an existing note.',
    parameters: obj({
      id: str('Card id from knowledge_search or knowledge_status, or a library note id.'),
    }, ['id']),
    output: {
      schema: obj({
        id: str('Note id.'),
        title: str('Title.'),
        path: str('Vault-relative path.'),
        body: str('Markdown body, bounded to 12000 characters.'),
      }, ['id', 'title', 'path', 'body']),
      ...renderText(value => `${value.title}\n${value.path}\n\n${value.body}`),
    },
    async execute(args) {
      const id = String((args && args.id) || '');
      let note;
      try {
        note = await store.getLibraryNote(id);
      } catch {
        const card = await store.getCandidate(id);
        note = { id: card.id, title: card.title, path: card.path, body: card.body };
      }
      return {
        id: note.id,
        title: note.title,
        path: note.path,
        body: String(note.body || '').slice(0, 12000),
      };
    },
    presentCall(args) {
      return { card: 'generic', title: 'Read knowledge note', kind: 'read', rawInput: { id: args && args.id } };
    },
  };
}

/** The `knowledge_ask` tool. */
function askTool(store) {
  return {
    name: 'knowledge_ask',
    description: 'Queue one concrete question for a later research round. Use it when the user says to dig further or asks a question that needs fresh sources; the next research round treats the oldest queued question as its focus.',
    parameters: obj({
      question: str('A specific, answerable question, at most 500 characters.'),
      cardId: str('Candidate or library card id this question came from, when there is one.'),
    }, ['question']),
    output: {
      schema: obj({
        id: str('Question id.'),
        question: str('Stored question.'),
        total: int('Queued question count after this call.'),
      }, ['id', 'question', 'total']),
      ...renderText(value => `已加入研究队列：${value.question}（${value.id}，队列共 ${value.total} 个问题）。`),
    },
    async execute(args) {
      const item = await store.addFollowup(String((args && args.question) || ''), args && args.cardId);
      return { id: item.id, question: item.question, total: item.total };
    },
    presentCall(args) {
      return { card: 'generic', title: 'Queue research question', kind: 'other', rawInput: { question: args && args.question } };
    },
  };
}

/** The `knowledge_brief` tool. */
function briefTool(store) {
  return {
    name: 'knowledge_brief',
    description: 'Write (or replace) the research brief for one day. Call it at the end of a research round with the focus, what was actually found, and the next questions.',
    parameters: obj({
      focus: str('The question this round answered, at most 300 characters.'),
      summary: str('What was researched and found. Plain Markdown; do not paste whole pages.'),
      nextQuestions: arr(str('Follow-up question.'), 'Up to five follow-up questions.'),
      date: str('YYYY-MM-DD; defaults to today.'),
    }, ['focus', 'summary']),
    output: {
      schema: obj({
        date: str('Brief date.'),
        path: str('Vault-relative path.'),
        focus: str('Stored focus.'),
      }, ['date', 'path', 'focus']),
      ...renderText(value => `研究简报已写入 ${value.date}：${value.path}（重点：${value.focus}）。`),
    },
    async execute(args) {
      const brief = await store.writeBrief({
        date: args && args.date,
        focus: String((args && args.focus) || ''),
        summary: String((args && args.summary) || ''),
        nextQuestions: args && args.nextQuestions,
      });
      return { date: brief.date, path: brief.path, focus: brief.focus };
    },
    presentCall(args) {
      return { card: 'generic', title: 'Write research brief', kind: 'edit', rawInput: { focus: args && args.focus } };
    },
  };
}
