/**
 * Knowledge workbench — browser half.
 *
 * A first-class main panel (sidebar icon → full page) plus its sidebar entry.
 * It renders the vault through the Host half's JSON API under
 * `/plugin/dsh-knowledge-workbench`; no other plugin's DOM or stylesheet is
 * touched. Styles use only `--dsw-alias-*` theme tokens (plus local aliases
 * that resolve to them), so light/dark themes and user font-size settings
 * carry over from the host page.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-knowledge-workbench',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'knowledge.workbench';
    const API_BASE = 'plugin/dsh-knowledge-workbench';
    const PANEL_ID = 'knowledge';

    /* -------------------------------------------------------------- */
    /* Copy                                                            */
    /* -------------------------------------------------------------- */

    const zh = {
      panel: '知识工作台',
      pageTitle: '知识工作台',
      refresh: '刷新',
      refreshHint: '重新读取仓库',
      runNow: '立即研究',
      runNowHint: '现在排入一次研究，几秒后会在新会话里运行',

      tabInbox: '收件箱',
      tabLibrary: '知识库',
      tabResearch: '研究',
      tabPrefs: '偏好与问题',
      ariaTabs: '工作台视图',

      statusOn: '研究已开启',
      statusOff: '研究未开启',
      statusMissing: '研究任务丢失',
      statusUnavailable: '无 schedule 服务',
      statusQueued: '研究已排队',

      ledePending: '{n} 张卡片等待确认',
      ledePendingOne: '{n} 张卡片等待确认',
      ledePendingZero: '没有待审阅卡片',
      ledeHold: '{n} 张暂缓',
      ledeHoldOne: '{n} 张暂缓',
      ledeLibrary: '{n} 篇笔记在知识库',
      ledeLibraryOne: '{n} 篇笔记在知识库',
      ledeLibraryOnly: '{n} 篇正式笔记，全部是本地 Markdown',
      ledeLibraryOnlyOne: '{n} 篇正式笔记，全部是本地 Markdown',
      ledeResearchOn: '每天 {time} 自动研究 · 下次 {next}',
      ledeResearchOff: '每日研究未开启',
      ledePrefs: '{topics} 个兴趣方向 · {n} 个问题排队',
      ledePrefsEmpty: '还没有偏好，填几项让研究更贴近你',

      searchPlaceholder: '搜索标题、摘要或标签',
      librarySearchPlaceholder: '搜索知识库',
      clearSearch: '清除搜索',
      filterPending: '待审阅',
      filterAll: '全部',
      filterHold: '暂缓',
      filterSkip: '跳过',

      emptyInbox: '收件箱是空的',
      emptyInboxHint: '点「立即研究」让悟查一轮资料，结果会先在这里等你确认。',
      emptySearch: '没有匹配的内容',
      emptySearchHint: '换个关键词，或清除搜索看全部卡片。',
      emptyFilter: '这个状态下没有卡片',
      emptyFilterHint: '切到「全部」可以查看已暂缓或已跳过的卡片。',
      emptyLibrary: '知识库还是空的',
      emptyLibraryHint: '在收件箱确认一张卡片后，它会变成知识库里的一篇笔记。',
      selectCard: '从左侧选一张卡片',
      selectCardHint: '也可以按 j / k 在列表里移动，Enter 打开当前卡片。',
      selectNote: '从左侧选一篇笔记',
      selectNoteHint: '支持按标题、摘要和标签搜索。',
      selectBrief: '从左侧选一天的研究简报',
      selectBriefHint: '每天的研究会写一份简报，记录当天重点和后续问题。',
      emptyBriefs: '还没有研究简报',
      emptyBriefsHint: '开启每日研究后，每天会写一份简报。',
      emptyQuestions: '还没有排队的研究问题。',
      emptyQuestionsHint: '在卡片里点「继续深挖」，或在上面的输入框手动添加。',

      reviewApprove: '确认入库',
      reviewHold: '暂缓',
      reviewSkip: '跳过',
      reviewDelete: '删除',
      reviewRestore: '恢复待审阅',
      deleteConfirm: '确认删除',
      deleteWarning: '删除只移走候选卡片，已入库的笔记不受影响。',
      reviewHint: '确认后这张卡会移到「知识库」，成为正式笔记。',
      restoreHint: '这张卡不在待审阅状态；恢复后会重新出现在收件箱。',
      statusPending: '待审阅',
      statusHold: '暂缓',
      statusSkip: '跳过',
      statusApproved: '已入库',
      statusDeleted: '已删除',
      approvedToast: '已入库，卡片已移到知识库',
      holdToast: '已暂缓',
      skipToast: '已跳过',
      restoreToast: '已恢复待审阅',
      deleteToast: '已删除候选卡片',
      createdLabel: '创建于',

      digButton: '继续深挖',
      digPlaceholder: '填一个具体问题，下一轮研究优先处理',
      digSubmit: '加入研究队列',
      digDone: '已加入队列，下一轮研究优先处理',
      digCancel: '取消',

      notePath: '文件',
      copyPath: '复制路径',
      copied: '已复制',
      copyFailed: '复制失败，请手动选择路径',
      back: '返回列表',
      cancel: '取消',
      retry: '重试',
      close: '关闭',
      loadFailed: '加载失败',
      saved: '已保存',
      unsaved: '有未保存的修改',

      researchTitle: '每日研究',
      researchOn: '已开启',
      researchOff: '未开启',
      researchMissing: '任务丢失，请重新开启',
      researchUnavailable: '当前 profile 没有 schedule 服务，无法启动研究任务',
      dailyTime: '每天时间',
      saveTime: '保存时间',
      nextRun: '下次',
      lastRun: '上次',
      never: '—',
      briefsTitle: '研究简报',
      briefsHint: '每天一份，记录当天研究重点与后续问题。',
      researchHint: '研究会在新会话里运行，复用当前模型与联网工具；卡片只进入收件箱，不会自动入库。',
      runQueued: '已排入队列，几秒后开始研究',
      queuedHint: '已排入研究队列，完成后卡片会进入收件箱。',
      queuedAt: '排队于 {time}',
      enableToast: '每日研究已开启',
      disableToast: '每日研究已停止',
      timeSavedToast: '研究时间已保存',

      prefsTitle: '研究偏好',
      prefsHint: '研究时按这些偏好挑选资料、组织问题和判断深浅。',
      prefsTopics: '兴趣方向',
      prefsTopicsHint: '用逗号分隔，最多 8 个',
      prefsLevel: '已有基础',
      prefsGoal: '学习目标',
      prefsStyle: '阅读习惯',
      prefsAvoid: '减少推荐',
      savePrefs: '保存偏好',
      prefsSaved: '偏好已保存',
      questionsTitle: '后续研究问题',
      questionPlaceholder: '手动添加一个具体问题',
      addQuestion: '添加',
      addQuestionDone: '问题已添加',
      remove: '移除',

      initTitle: '初始化知识仓库',
      initBody: '会在下面的目录里创建 inbox、library、briefs、.workbench 四个目录，以及 README.md、偏好.md、待研究.md 和「知识工作台.base」；全部是普通 Markdown，可以用 Obsidian 打开。',
      initAction: '初始化仓库',
      initPath: '仓库位置',
      initStepResearch: '研究',
      initStepResearchHint: 'agent 查资料，写带引文的候选卡片',
      initStepReview: '审阅',
      initStepReviewHint: '你确认、暂缓或跳过',
      initStepPublish: '入库',
      initStepPublishHint: '确认的卡片成为正式笔记',

      vaultLabel: '仓库',
      basesLabel: 'Bases',
      basesHint: '用 Obsidian 打开「知识工作台.base」查看待审阅、知识库和研究简报；在表格里把 review 改成「确认」也会入库。',
      shortcutMoveLabel: '移动',
      shortcutSearchLabel: '搜索',
      shortcutCancelLabel: '取消',

      weekday0: '周日',
      weekday1: '周一',
      weekday2: '周二',
      weekday3: '周三',
      weekday4: '周四',
      weekday5: '周五',
      weekday6: '周六',
      today: '今天',
      yesterday: '昨天',
      daysAgo: '{n} 天前',
    };

    const en = {
      panel: 'Knowledge',
      pageTitle: 'Knowledge workbench',
      refresh: 'Refresh',
      refreshHint: 'Reload the vault',
      runNow: 'Research now',
      runNowHint: 'Queue one research run in a new session',

      tabInbox: 'Inbox',
      tabLibrary: 'Library',
      tabResearch: 'Research',
      tabPrefs: 'Preferences',
      ariaTabs: 'Workbench views',

      statusOn: 'Research on',
      statusOff: 'Research off',
      statusMissing: 'Research task missing',
      statusUnavailable: 'No schedule service',
      statusQueued: 'Research queued',

      ledePending: '{n} cards to review',
      ledePendingOne: '1 card to review',
      ledePendingZero: 'No cards to review',
      ledeHold: '{n} on hold',
      ledeHoldOne: '1 on hold',
      ledeLibrary: '{n} notes in the library',
      ledeLibraryOne: '1 note in the library',
      ledeLibraryOnly: '{n} notes in the library, all local Markdown',
      ledeLibraryOnlyOne: '1 note in the library, all local Markdown',
      ledeResearchOn: 'Daily research at {time} · next {next}',
      ledeResearchOff: 'Daily research is off',
      ledePrefs: '{topics} topics · {n} queued questions',
      ledePrefsEmpty: 'No preferences yet — add a few so research fits you',

      searchPlaceholder: 'Search titles, summaries, tags',
      librarySearchPlaceholder: 'Search the library',
      clearSearch: 'Clear search',
      filterPending: 'To review',
      filterAll: 'All',
      filterHold: 'On hold',
      filterSkip: 'Skipped',

      emptyInbox: 'The inbox is empty',
      emptyInboxHint: 'Use “Research now” to run a round; results wait here for your review.',
      emptySearch: 'No matches',
      emptySearchHint: 'Try another term, or clear the search to see everything.',
      emptyFilter: 'Nothing in this state',
      emptyFilterHint: 'Switch to “All” to see cards you held or skipped.',
      emptyLibrary: 'The library is empty',
      emptyLibraryHint: 'Publish a card from the inbox and it becomes a note here.',
      selectCard: 'Pick a card on the left',
      selectCardHint: 'Or press j / k to move through the list and Enter to open one.',
      selectNote: 'Pick a note on the left',
      selectNoteHint: 'Search by title, summary, or tag.',
      selectBrief: 'Pick a day on the left',
      selectBriefHint: 'Each research day writes one brief with its focus and next questions.',
      emptyBriefs: 'No briefs yet',
      emptyBriefsHint: 'Turn on daily research and one brief lands here each day.',
      emptyQuestions: 'No queued questions.',
      emptyQuestionsHint: 'Use “Dig deeper” on a card, or add one above.',

      reviewApprove: 'Publish',
      reviewHold: 'Hold',
      reviewSkip: 'Skip',
      reviewDelete: 'Delete',
      reviewRestore: 'Move back to review',
      deleteConfirm: 'Confirm delete',
      deleteWarning: 'Deleting only removes the candidate; published notes are untouched.',
      reviewHint: 'Publishing moves this card into the library as a permanent note.',
      restoreHint: 'This card is not waiting for review; restoring returns it to the inbox.',
      statusPending: 'To review',
      statusHold: 'On hold',
      statusSkip: 'Skipped',
      statusApproved: 'Published',
      statusDeleted: 'Deleted',
      approvedToast: 'Published — moved to the library',
      holdToast: 'Moved on hold',
      skipToast: 'Skipped',
      restoreToast: 'Moved back to review',
      deleteToast: 'Candidate deleted',
      createdLabel: 'Created',

      digButton: 'Dig deeper',
      digPlaceholder: 'Queue one concrete question for the next round',
      digSubmit: 'Queue question',
      digDone: 'Queued for the next research round',
      digCancel: 'Cancel',

      notePath: 'File',
      copyPath: 'Copy path',
      copied: 'Copied',
      copyFailed: 'Copy failed — select the path manually',
      back: 'Back to list',
      cancel: 'Cancel',
      retry: 'Retry',
      close: 'Close',
      loadFailed: 'Could not load',
      saved: 'Saved',
      unsaved: 'Unsaved changes',

      researchTitle: 'Daily research',
      researchOn: 'On',
      researchOff: 'Off',
      researchMissing: 'Task missing — enable it again',
      researchUnavailable: 'This profile has no schedule service, so research cannot start',
      dailyTime: 'Daily time',
      saveTime: 'Save time',
      nextRun: 'Next',
      lastRun: 'Last',
      never: '—',
      briefsTitle: 'Research briefs',
      briefsHint: 'One per research day, with its focus and next questions.',
      researchHint: 'Research runs in a new session with your current model and tools; cards only reach the inbox.',
      runQueued: 'Queued — research starts in a few seconds',
      queuedHint: 'Queued; cards arrive in the inbox when the run finishes.',
      queuedAt: 'Queued for {time}',
      enableToast: 'Daily research enabled',
      disableToast: 'Daily research stopped',
      timeSavedToast: 'Research time saved',

      prefsTitle: 'Research preferences',
      prefsHint: 'Research uses these to choose material, shape questions, and set depth.',
      prefsTopics: 'Topics',
      prefsTopicsHint: 'Comma separated, up to 8',
      prefsLevel: 'Current level',
      prefsGoal: 'Learning goal',
      prefsStyle: 'Reading style',
      prefsAvoid: 'Less of this',
      savePrefs: 'Save preferences',
      prefsSaved: 'Preferences saved',
      questionsTitle: 'Queued questions',
      questionPlaceholder: 'Add a concrete question',
      addQuestion: 'Add',
      addQuestionDone: 'Question added',
      remove: 'Remove',

      initTitle: 'Initialize the knowledge vault',
      initBody: 'Creates the inbox, library, briefs, and .workbench folders plus README.md, preference and question notes, and the “知识工作台.base” database in the directory below. Everything is plain Markdown, readable in Obsidian.',
      initAction: 'Initialize',
      initPath: 'Vault location',
      initStepResearch: 'Research',
      initStepResearchHint: 'The agent researches and writes cards with quotes',
      initStepReview: 'Review',
      initStepReviewHint: 'You publish, hold, or skip',
      initStepPublish: 'Publish',
      initStepPublishHint: 'Approved cards become permanent notes',

      vaultLabel: 'Vault',
      basesLabel: 'Bases',
      basesHint: 'Open “知识工作台.base” in Obsidian for the review queue, library, and briefs; setting review to 确认 there also publishes.',
      shortcutMoveLabel: 'move',
      shortcutSearchLabel: 'search',
      shortcutCancelLabel: 'cancel',

      weekday0: 'Sun',
      weekday1: 'Mon',
      weekday2: 'Tue',
      weekday3: 'Wed',
      weekday4: 'Thu',
      weekday5: 'Fri',
      weekday6: 'Sat',
      today: 'Today',
      yesterday: 'Yesterday',
      daysAgo: '{n}d ago',
    };

    const REVIEW_LABEL = {
      待审阅: 'statusPending',
      暂缓: 'statusHold',
      跳过: 'statusSkip',
      已入库: 'statusApproved',
      已删除: 'statusDeleted',
    };

    const TABS = ['inbox', 'library', 'research', 'prefs'];
    const FILTERS = ['pending', 'all', 'hold', 'skip'];

    /* -------------------------------------------------------------- */
    /* Data access                                                     */
    /* -------------------------------------------------------------- */

    function apiUrl(path) {
      return new URL(`${API_BASE}/${path}`, document.baseURI).toString();
    }

    async function callApi(path, body) {
      const response = await fetch(apiUrl(path), body === undefined
        ? { method: 'GET', headers: { Accept: 'application/json' } }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
          });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok || !data || data.ok === false) {
        const message = data && data.error ? data.error : `HTTP ${response.status}`;
        throw new Error(message);
      }
      return data;
    }

    function pad(value) {
      return String(value).padStart(2, '0');
    }

    function formatMoment(value, today) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const year = String(date.getFullYear());
      const prefix = today && today.startsWith(year) ? '' : `${year}-`;
      return `${prefix}${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function stripLeadingTitle(body, title) {
      const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
      if (lines.length && /^#\s+/.test(lines[0]) && lines[0].replace(/^#\s+/, '').trim() === String(title || '').trim()) {
        return lines.slice(1).join('\n');
      }
      return body;
    }

    function statusOf(card) {
      return (card && card.review) || '待审阅';
    }

    function matchesFilter(card, filter) {
      if (filter === 'all') return true;
      return statusOf(card) === { pending: '待审阅', hold: '暂缓', skip: '跳过' }[filter];
    }

    function filterCandidates(cards, filter, query) {
      const needle = String(query || '').trim().toLowerCase();
      return cards.filter(card => matchesFilter(card, filter)
        && (!needle || `${card.title}\n${card.excerpt}\n${(card.tags || []).join(' ')}`.toLowerCase().includes(needle)));
    }

    function filterNotes(notes, query) {
      const needle = String(query || '').trim().toLowerCase();
      if (!needle) return notes;
      return notes.filter(note => `${note.title}\n${note.excerpt}\n${(note.tags || []).join(' ')}`.toLowerCase().includes(needle));
    }

    function dayIndex(date) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
      if (!match) return null;
      return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
    }

    function weekdayKey(date) {
      const index = dayIndex(date);
      if (index === null) return '';
      return `weekday${new Date(index * 86400000).getUTCDay()}`;
    }

    function relativeDay(date, today, t, tf) {
      const target = dayIndex(date);
      const base = dayIndex(today);
      if (target === null) return date || '';
      if (base !== null) {
        const diff = base - target;
        if (diff === 0) return t('today');
        if (diff === 1) return t('yesterday');
        if (diff > 1 && diff < 31) return tf('daysAgo', { n: diff });
      }
      const year = String(today || '').slice(0, 4);
      return String(date).slice(0, 4) === year ? String(date).slice(5) : String(date);
    }

    function basename(value) {
      const parts = String(value || '').split(/[\\/]/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : String(value || '');
    }

    function isTypingTarget(target) {
      if (!target || typeof target !== 'object') return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
    }

    /* -------------------------------------------------------------- */
    /* Icons                                                           */
    /* -------------------------------------------------------------- */

    const ICONS = {

      refresh: [
        ['path', { d: 'M20 11a8 8 0 1 0-2.6 5.9' }],
        ['path', { d: 'M20 4v7h-7' }],
      ],
      spark: [
        ['path', { d: 'M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z' }],
        ['path', { d: 'M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z' }],
      ],
      search: [
        ['circle', { cx: 11, cy: 11, r: 6.5 }],
        ['path', { d: 'M16 16l4.2 4.2' }],
      ],
      check: [['path', { d: 'M4.8 12.6l4.5 4.5L19.2 7' }]],
      hold: [
        ['path', { d: 'M9.5 5.5v13' }],
        ['path', { d: 'M14.5 5.5v13' }],
      ],
      skip: [
        ['path', { d: 'M6 5.5l8 6.5-8 6.5z' }],
        ['path', { d: 'M18 5.5v13' }],
      ],
      restore: [
        ['path', { d: 'M4 11a8 8 0 1 0 2.6-5.9' }],
        ['path', { d: 'M4 4v7h7' }],
      ],
      trash: [
        ['path', { d: 'M4.5 7h15' }],
        ['path', { d: 'M9.5 7V5.2c0-.7.6-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7' }],
        ['path', { d: 'M6.5 7l.8 11.1c.1.8.7 1.4 1.5 1.4h6.4c.8 0 1.4-.6 1.5-1.4L17.5 7' }],
      ],
      copy: [
        ['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2.2 }],
        ['path', { d: 'M15 6.5V5.7c0-1-.8-1.7-1.7-1.7H5.7C4.8 4 4 4.8 4 5.7v7.6c0 1 .8 1.7 1.7 1.7h.8' }],
      ],

      x: [
        ['path', { d: 'M6 6l12 12' }],
        ['path', { d: 'M18 6L6 18' }],
      ],
      left: [['path', { d: 'M14.5 5.5L8 12l6.5 6.5' }]],
      alert: [
        ['path', { d: 'M12 8v5' }],
        ['path', { d: 'M12 16.4v.1' }],
        ['circle', { cx: 12, cy: 12, r: 8.5 }],
      ],
      info: [
        ['circle', { cx: 12, cy: 12, r: 8.5 }],
        ['path', { d: 'M12 11v5' }],
        ['path', { d: 'M12 7.7v.1' }],
      ],
      inbox: [
        ['path', { d: 'M4 13.5l2.2-6.7A2 2 0 0 1 8.1 5.5h7.8a2 2 0 0 1 1.9 1.3l2.2 6.7' }],
        ['path', { d: 'M4 13.5h4.2l1.2 2.2h5.2l1.2-2.2H20v4.1a1.9 1.9 0 0 1-1.9 1.9H5.9A1.9 1.9 0 0 1 4 17.6z' }],
      ],
      library: [
        ['path', { d: 'M5.5 5.5v13' }],
        ['path', { d: 'M10 5.5v13' }],
        ['path', { d: 'M14.2 6.2l3.6-.9 2.4 12.2-3.6.9z' }],
      ],
      compass: [
        ['circle', { cx: 12, cy: 12, r: 8.5 }],
        ['path', { d: 'M14.8 9.2l-1.6 4-4 1.6 1.6-4z' }],
      ],


    };

    function Icon(props) {
      const name = props.name;
      const size = typeof props.size === 'number' ? props.size : 16;
      const shapes = ICONS[name] || [];
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props.weight || 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
        className: props.className || undefined,
      }, shapes.map((shape, index) => h(shape[0], { key: index, ...shape[1] })));
    }

    function BookIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 20;
      const active = Boolean(props.active);
      const strokeWidth = active ? 1.9 : 1.6;
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
        focusable: false,
      },
        h('path', {
          d: 'M4 5.6c2.5-1 5-1 7.4.4v13c-2.4-1.4-4.9-1.4-7.4-.4z',
          stroke: 'currentColor', strokeWidth, strokeLinejoin: 'round', strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M20 5.6c-2.5-1-5-1-7.4.4v13c2.4-1.4 4.9-1.4 7.4-.4z',
          stroke: 'currentColor', strokeWidth, strokeLinejoin: 'round', strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M16.9 3.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z',
          fill: 'currentColor',
        }));
    }

    /* -------------------------------------------------------------- */
    /* Small UI building blocks                                        */
    /* -------------------------------------------------------------- */

    function Button(props) {
      const { variant, small, className, children, ...rest } = props;
      return h('button', {
        type: 'button',
        className: [
          'kbw-btn',
          variant ? `kbw-btn--${variant}` : '',
          small ? 'kbw-btn--sm' : '',
          className || '',
        ].filter(Boolean).join(' '),
        ...rest,
      }, children);
    }

    function IconButton(props) {
      const { name, label, size, tone, className, children, ...rest } = props;
      return h('button', {
        type: 'button',
        className: ['kbw-iconbtn', tone ? `kbw-iconbtn--${tone}` : '', className || ''].filter(Boolean).join(' '),
        'aria-label': label,
        title: label,
        ...rest,
      }, children || h(Icon, { name, size: size || 15 }));
    }

    function Chip(props) {
      return h('span', { className: 'kbw-chip', 'data-tone': props.tone || undefined },
        props.tone ? h(Dot, { tone: props.tone }) : null,
        props.children);
    }

    function Dot(props) {
      return h('span', { className: 'kbw-dot', 'data-tone': props.tone || undefined });
    }

    function Kbd(props) {
      return h('kbd', { className: 'kbw-kbd' }, props.children);
    }

    function Switch(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': Boolean(props.checked),
        'aria-label': props.label,
        className: 'kbw-switch',
        disabled: props.disabled,
        onClick: props.onChange,
      });
    }

    function Skeleton(props) {
      return h('span', { className: 'kbw-skeleton', 'data-w': props.width || undefined, 'data-h': props.height || undefined });
    }

    function EmptyState(props) {
      return h('div', {
        className: ['kbw-empty', props.compact ? 'kbw-empty--compact' : '', props.fill === false ? '' : 'kbw-empty--fill'].filter(Boolean).join(' '),
      },
        props.icon ? h('span', { className: 'kbw-empty-icon' }, h(Icon, { name: props.icon, size: 19 })) : null,
        h('b', null, props.title),
        props.hint ? h('p', null, props.hint) : null,
        props.footnote ? h('p', { className: 'kbw-empty-footnote' }, props.footnote) : null,
        props.action ? h('div', { className: 'kbw-empty-actions' }, props.action) : null);
    }

    /* -------------------------------------------------------------- */
    /* Markdown                                                        */
    /* -------------------------------------------------------------- */

    function inlineNodes(text, prefix) {
      const nodes = [];
      const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\(https?:[^)\s]+\))/g;
      let last = 0;
      let index = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index));
        const token = match[0];
        const key = `${prefix}-i${index++}`;
        if (token.startsWith('**') || token.startsWith('__')) {
          nodes.push(h('strong', { key }, token.slice(2, -2)));
        } else if (token.startsWith('`')) {
          nodes.push(h('code', { key }, token.slice(1, -1)));
        } else if (token.startsWith('[')) {
          const link = /^\[([^\]]+)\]\((https?:[^)\s]+)\)$/.exec(token);
          nodes.push(link
            ? h('a', { key, href: link[2], target: '_blank', rel: 'noreferrer noopener' }, link[1])
            : token);
        } else {
          nodes.push(h('em', { key }, token.slice(1, -1)));
        }
        last = match.index + token.length;
      }
      if (last < text.length) nodes.push(text.slice(last));
      return nodes;
    }

    function splitRow(line) {
      const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
      const cells = [];
      let current = '';
      for (let index = 0; index < trimmed.length; index += 1) {
        const char = trimmed[index];
        if (char === '\\' && trimmed[index + 1] === '|') {
          current += '|';
          index += 1;
        } else if (char === '|') {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    }

    function tableAlign(cell) {
      const left = cell.startsWith(':');
      const right = cell.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      return 'left';
    }

    function parseListBlock(lines, start, baseIndent) {
      const items = [];
      let index = start;
      while (index < lines.length) {
        const match = lines[index].match(/^([ \t]*)([-*+]|\d+\.)[ \t]+(.*)$/);
        if (!match) break;
        const indent = match[1].replace(/\t/g, '    ').length;
        if (indent < baseIndent) break;
        if (indent > baseIndent) {
          if (!items.length) break;
          const nested = parseListBlock(lines, index, indent);
          if (!nested.items.length) break;
          items[items.length - 1].children.push(nested.items);
          index = nested.index;
          continue;
        }
        items.push({ text: match[3], ordered: /^\d+\.$/.test(match[2]), children: [] });
        index += 1;
      }
      return { items, index };
    }

    function listNode(items, keyBase, key) {
      const tag = items[0].ordered ? 'ol' : 'ul';
      return h(tag, { key }, items.map((item, index) => h('li', { key: `${keyBase}-li${index}` },
        inlineNodes(item.text, `${keyBase}-li${index}`),
        item.children.map((child, childIndex) => listNode(child, `${keyBase}-li${index}-c${childIndex}`, `${keyBase}-li${index}-c${childIndex}`)))));
    }

    function Markdown(props) {
      const text = String(props.text || '').replace(/\r\n/g, '\n');
      const lines = text.split('\n');
      const blocks = [];
      const keyBase = props.prefix || 'md';
      const push = node => blocks.push(h(React.Fragment, { key: `${keyBase}-b${blocks.length}` }, node));
      let index = 0;
      let paragraph = [];
      const flush = () => {
        if (!paragraph.length) return;
        const content = paragraph.join(' ');
        push(h('p', null, inlineNodes(content, `${keyBase}-p${blocks.length}`)));
        paragraph = [];
      };
      while (index < lines.length) {
        const line = lines[index];
        if (/^\s*```/.test(line)) {
          flush();
          const code = [];
          index += 1;
          while (index < lines.length && !/^\s*```/.test(lines[index])) {
            code.push(lines[index]);
            index += 1;
          }
          index += 1;
          push(h('pre', null, h('code', null, code.join('\n'))));
          continue;
        }
        if (/^\s*$/.test(line)) {
          flush();
          index += 1;
          continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
          flush();
          const level = Math.min(heading[1].length + 1, 5);
          push(h(`h${level}`, null, inlineNodes(heading[2], `${keyBase}-h${blocks.length}`)));
          index += 1;
          continue;
        }
        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
          flush();
          push(h('hr', null));
          index += 1;
          continue;
        }
        if (/^\s*\|/.test(line) && index + 1 < lines.length
          && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1]) && /-/.test(lines[index + 1])) {
          flush();
          const header = splitRow(line);
          const align = splitRow(lines[index + 1]).map(tableAlign);
          index += 2;
          const rows = [];
          while (index < lines.length && /^\s*\|/.test(lines[index])) {
            rows.push(splitRow(lines[index]));
            index += 1;
          }
          push(h('table', null,
            h('thead', null, h('tr', null, header.map((cell, cellIndex) => h('th', {
              key: `th${cellIndex}`,
              className: `kbw-align-${align[cellIndex] || 'left'}`,
            }, inlineNodes(cell, `${keyBase}-th${blocks.length}-${cellIndex}`))))),
            h('tbody', null, rows.map((row, rowIndex) => h('tr', { key: `tr${rowIndex}` },
              row.map((cell, cellIndex) => h('td', {
                key: `td${cellIndex}`,
                className: `kbw-align-${align[cellIndex] || 'left'}`,
              }, inlineNodes(cell, `${keyBase}-td${blocks.length}-${rowIndex}-${cellIndex}`))))))));
          continue;
        }
        if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
          flush();
          const parsed = parseListBlock(lines, index, line.match(/^\s*/)[0].length);
          index = parsed.index;
          if (parsed.items.length) push(listNode(parsed.items, `${keyBase}-l${blocks.length}`, `${keyBase}-l${blocks.length}`));
          continue;
        }
        if (/^\s*>/.test(line)) {
          flush();
          const quoted = [];
          while (index < lines.length && /^\s*>/.test(lines[index])) {
            quoted.push(lines[index].replace(/^\s*>\s?/, ''));
            index += 1;
          }
          push(h('blockquote', null,
            quoted.map((part, partIndex) => h('p', { key: `q${partIndex}` }, inlineNodes(part, `${keyBase}-q${blocks.length}-${partIndex}`)))));
          continue;
        }
        paragraph.push(line.trim());
        index += 1;
      }
      flush();
      return h('div', { className: 'kbw-md' }, blocks);
    }

    /* -------------------------------------------------------------- */
    /* Main panel                                                      */
    /* -------------------------------------------------------------- */

    function WorkbenchPage(props) {
      const translate = props.t;
      const t = React.useCallback(key => {
        const value = typeof translate === 'function' ? translate(key) : undefined;
        return value && value !== key ? value : (zh[key] || key);
      }, [translate]);
      const tf = React.useCallback((key, vars) => {
        let value = t(key);
        for (const name of Object.keys(vars || {})) value = value.replace(`{${name}}`, String(vars[name]));
        return value;
      }, [t]);

      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState('');
      const [toast, setToast] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [tab, setTab] = React.useState('inbox');

      const [cardFilter, setCardFilter] = React.useState('pending');
      const [cardQuery, setCardQuery] = React.useState('');
      const [selectedCardId, setSelectedCardId] = React.useState(null);
      const [focusedId, setFocusedId] = React.useState(null);
      const [cardBody, setCardBody] = React.useState(null);
      const [cardLoading, setCardLoading] = React.useState(false);
      const [cardError, setCardError] = React.useState('');

      const [libraryQuery, setLibraryQuery] = React.useState('');
      const [selectedNoteId, setSelectedNoteId] = React.useState(null);
      const [noteBody, setNoteBody] = React.useState(null);
      const [noteLoading, setNoteLoading] = React.useState(false);
      const [noteError, setNoteError] = React.useState('');

      const [selectedBriefDate, setSelectedBriefDate] = React.useState(null);
      const [briefBody, setBriefBody] = React.useState(null);
      const [briefLoading, setBriefLoading] = React.useState(false);
      const [briefError, setBriefError] = React.useState('');

      const [deleteArmed, setDeleteArmed] = React.useState(null);
      const [digOpen, setDigOpen] = React.useState(false);
      const [digQuestion, setDigQuestion] = React.useState('');
      const [questionDraft, setQuestionDraft] = React.useState('');
      const [researchTime, setResearchTime] = React.useState('09:00');
      const [copied, setCopied] = React.useState('');
      const [form, setForm] = React.useState({ topics: '', level: '', goal: '', style: '', avoid: '' });
      const [formDirty, setFormDirty] = React.useState(false);

      const alive = React.useRef(true);
      const pageRef = React.useRef(null);
      const searchRef = React.useRef(null);
      const readerRef = React.useRef(null);
      const rowRefs = React.useRef({});
      const formDirtyRef = React.useRef(false);
      const researchServerTime = React.useRef('');
      const autoCardRef = React.useRef(false);
      const selectedCardRef = React.useRef(null);
      const stateSeq = React.useRef(0);

      React.useEffect(() => () => { alive.current = false; }, []);
      React.useEffect(() => { formDirtyRef.current = formDirty; }, [formDirty]);
      React.useEffect(() => { selectedCardRef.current = selectedCardId; }, [selectedCardId]);

      const load = React.useCallback(async (options) => {
        const seq = ++stateSeq.current;
        try {
          const data = await callApi('state');
          if (!alive.current || seq !== stateSeq.current) return;
          setState(data);
          setError('');
          if (selectedCardRef.current && Array.isArray(data.cards)
            && !data.cards.some(card => card.id === selectedCardRef.current)) {
            // The open candidate was published or deleted elsewhere (for example
            // in Obsidian Bases): fall back to the empty reader instead of
            // leaving a stale card with actions that can no longer succeed.
            selectedCardRef.current = null;
            setSelectedCardId(null);
            setCardBody(null);
          }
          if (data.research && typeof data.research.time === 'string' && data.research.time !== researchServerTime.current) {
            researchServerTime.current = data.research.time;
            setResearchTime(data.research.time);
          }
          setForm(current => {
            if ((options && options.resetForm) || !formDirtyRef.current) {
              return {
                topics: Array.isArray(data.preferences.topics) ? data.preferences.topics.join(', ') : '',
                level: data.preferences.level || '',
                goal: data.preferences.goal || '',
                style: data.preferences.style || '',
                avoid: data.preferences.avoid || '',
              };
            }
            return current;
          });
        } catch (caught) {
          if (alive.current && seq === stateSeq.current) setError(caught.message);
        }
      }, []);

      React.useEffect(() => {
        void load();
        const timer = setInterval(() => { void load(); }, 15000);
        return () => clearInterval(timer);
      }, [load]);

      React.useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), 3600);
        return () => clearTimeout(timer);
      }, [toast]);

      const notify = React.useCallback((text, tone) => {
        setToast({ id: Date.now(), text, tone: tone || 'ok' });
      }, []);

      const act = React.useCallback(async (path, body) => {
        setBusy(true);
        setError('');
        try {
          const data = await callApi(path, body);
          if (data.state) {
            // A decision's snapshot is newer than any poll already in flight.
            stateSeq.current += 1;
            setState(data.state);
          } else {
            await load();
          }
          return data;
        } catch (caught) {
          if (alive.current) setError(caught.message);
          return null;
        } finally {
          if (alive.current) setBusy(false);
        }
      }, [load]);

      const cardSeq = React.useRef(0);
      const showCard = React.useCallback((id, data) => {
        cardSeq.current += 1;
        setSelectedCardId(id);
        setCardBody(data || null);
        setCardError('');
        setCardLoading(false);
        setDeleteArmed(null);
        setDigOpen(false);
        setDigQuestion('');
      }, []);
      const openCard = React.useCallback(async id => {
        const seq = ++cardSeq.current;
        setSelectedCardId(id);
        setCardBody(null);
        setCardError('');
        setDeleteArmed(null);
        setCardLoading(true);
        setDigOpen(false);
        setDigQuestion('');
        try {
          const data = await callApi(`card?id=${encodeURIComponent(id)}`);
          if (alive.current && seq === cardSeq.current) setCardBody(data);
        } catch (caught) {
          if (alive.current && seq === cardSeq.current) setCardError(caught.message);
        } finally {
          if (alive.current && seq === cardSeq.current) setCardLoading(false);
        }
      }, []);

      const noteSeq = React.useRef(0);
      const openNote = React.useCallback(async id => {
        const seq = ++noteSeq.current;
        setSelectedNoteId(id);
        setNoteBody(null);
        setNoteError('');
        setNoteLoading(true);
        try {
          const data = await callApi(`note?id=${encodeURIComponent(id)}`);
          if (alive.current && seq === noteSeq.current) setNoteBody(data);
        } catch (caught) {
          if (alive.current && seq === noteSeq.current) setNoteError(caught.message);
        } finally {
          if (alive.current && seq === noteSeq.current) setNoteLoading(false);
        }
      }, []);

      const briefSeq = React.useRef(0);
      const openBrief = React.useCallback(async date => {
        const seq = ++briefSeq.current;
        setSelectedBriefDate(date);
        setBriefBody(null);
        setBriefError('');
        setBriefLoading(true);
        try {
          const data = await callApi(`brief?date=${encodeURIComponent(date)}`);
          if (alive.current && seq === briefSeq.current) setBriefBody(data);
        } catch (caught) {
          if (alive.current && seq === briefSeq.current) setBriefError(caught.message);
        } finally {
          if (alive.current && seq === briefSeq.current) setBriefLoading(false);
        }
      }, []);

      const cards = state ? state.cards : [];
      const visibleCards = React.useMemo(
        () => filterCandidates(cards, cardFilter, cardQuery),
        [cards, cardFilter, cardQuery],
      );
      const visibleLibrary = React.useMemo(
        () => filterNotes(state ? state.library : [], libraryQuery),
        [state, libraryQuery],
      );

      const reviewLock = React.useRef(false);
      const focusRow = React.useCallback(id => {
        const row = rowRefs.current[id];
        if (!row) return;
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: 'nearest' });
      }, []);

      const review = React.useCallback(async (id, action) => {
        if (reviewLock.current) return;
        reviewLock.current = true;
        try {
          const before = visibleCards.map(card => card.id);
          const onOpenCard = selectedCardId === id;
          const keepsCard = action === 'hold' || action === 'skip' || action === 'pending';
          const position = Math.max(before.indexOf(id), 0);
          const remaining = before.filter(cardId => cardId !== id);
          const nextId = remaining[position] || remaining[remaining.length - 1] || null;
          // Fetch the next card while the review request runs, so the reader does
          // not show a skeleton after a decision.
          const mayLeave = cardFilter !== 'all' || !keepsCard;
          const prefetch = onOpenCard && mayLeave && nextId
            ? callApi(`card?id=${encodeURIComponent(nextId)}`).catch(() => null)
            : null;
          const result = await act('review', { id, action });
          if (!result) return;
          setDeleteArmed(null);
          const nextCards = result.state && Array.isArray(result.state.cards) ? result.state.cards : [];
          const stillVisible = keepsCard && filterCandidates(nextCards, cardFilter, cardQuery).some(card => card.id === id);
          if (!onOpenCard) {
            // A row action must not move the reader, its scroll position, or an
            // in-progress "dig deeper" draft for another card.
            if (!stillVisible && nextId) focusRow(nextId);
          } else if (stillVisible) {
            // Hold/skip/restore keep the card in view: patch the open body from
            // the response instead of refetching and blanking the reader.
            const updated = result.review;
            setCardBody(current => (current && current.id === id
              ? { ...current, review: updated || current.review }
              : current));
          } else if (nextId) {
            const body = prefetch ? await prefetch : null;
            if (body) showCard(nextId, body);
            else await openCard(nextId);
            focusRow(nextId);
          } else {
            setSelectedCardId(null);
            setCardBody(null);
          }
          notify(t({
            approve: 'approvedToast',
            hold: 'holdToast',
            skip: 'skipToast',
            pending: 'restoreToast',
            delete: 'deleteToast',
          }[action] || 'saved'));
        } finally {
          reviewLock.current = false;
        }
      }, [act, cardFilter, cardQuery, focusRow, notify, openCard, selectedCardId, showCard, t, visibleCards]);

      const submitDig = React.useCallback(async () => {
        const question = digQuestion.trim();
        if (!question) return;
        const result = await act('followup', { question, cardId: selectedCardId || undefined });
        if (!result) return;
        setDigOpen(false);
        setDigQuestion('');
        notify(t('digDone'));
      }, [act, digQuestion, notify, selectedCardId, t]);

      const addQuestion = React.useCallback(async () => {
        const question = questionDraft.trim();
        if (!question) return;
        const result = await act('followup', { question });
        if (!result) return;
        setQuestionDraft('');
        notify(t('addQuestionDone'));
      }, [act, notify, questionDraft, t]);

      const savePreferences = React.useCallback(async () => {
        const result = await act('preferences', form);
        if (!result) return;
        setFormDirty(false);
        notify(t('prefsSaved'));
      }, [act, form, notify, t]);

      const researchAction = React.useCallback(async (action, extra, message) => {
        const result = await act('research', { action, ...(extra || {}) });
        if (!result) return;
        if (message) notify(t(message));
      }, [act, notify, t]);

      const copyText = React.useCallback(async value => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(value);
          setTimeout(() => setCopied(''), 1600);
        } catch {
          notify(t('copyFailed'), 'warn');
        }
      }, [notify, t]);

      const updateForm = (key, value) => {
        setForm(current => ({ ...current, [key]: value }));
        setFormDirty(true);
      };

      /* Open the first card once, so the panel never starts on an empty page. */
      React.useEffect(() => {
        if (autoCardRef.current || !state || !state.initialized) return;
        if (selectedCardId || !visibleCards.length) return;
        autoCardRef.current = true;
        void openCard(visibleCards[0].id);
      }, [state, selectedCardId, visibleCards, openCard]);

      /* Show the newest brief as soon as the research view opens. */
      React.useEffect(() => {
        if (tab !== 'research' || selectedBriefDate || !state || !state.briefs.length) return;
        void openBrief(state.briefs[0].date);
      }, [tab, state, selectedBriefDate, openBrief]);

      /* Reset the reader scroll position whenever its content changes. */
      React.useEffect(() => {
        if (readerRef.current) readerRef.current.scrollTop = 0;
      }, [selectedCardId, selectedNoteId, selectedBriefDate, cardBody, noteBody, briefBody]);

      const moveSelection = React.useCallback(delta => {
        const ids = visibleCards.map(card => card.id);
        if (!ids.length) return;
        const anchor = ids.includes(focusedId) ? focusedId : selectedCardId;
        const current = ids.indexOf(anchor);
        const next = current < 0
          ? (delta > 0 ? 0 : ids.length - 1)
          : Math.max(0, Math.min(ids.length - 1, current + delta));
        const id = ids[next];
        void openCard(id);
        focusRow(id);
      }, [focusRow, focusedId, openCard, selectedCardId, visibleCards]);

      React.useEffect(() => {
        function onKeyDown(event) {
          if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
          const active = document.activeElement;
          if (active && active !== document.body && pageRef.current && !pageRef.current.contains(active)) return;
          const typing = isTypingTarget(event.target);
          if (event.key === 'Escape') {
            if (typing) {
              event.target.blur();
              return;
            }
            if (digOpen) {
              setDigOpen(false);
              return;
            }
            if (deleteArmed) {
              setDeleteArmed(null);
              const trigger = document.getElementById('kbw-delete-trigger');
              if (trigger) trigger.focus();
              return;
            }
            if (cardQuery) {
              setCardQuery('');
              return;
            }
            if (libraryQuery) {
              setLibraryQuery('');
              return;
            }
            return;
          }
          if (typing) return;
          if (event.key === '/' && (tab === 'inbox' || tab === 'library')) {
            event.preventDefault();
            if (searchRef.current) searchRef.current.focus();
            return;
          }
          if (tab === 'inbox') {
            if (event.key === 'j') {
              event.preventDefault();
              moveSelection(1);
              return;
            }
            if (event.key === 'k') {
              event.preventDefault();
              moveSelection(-1);
              return;
            }
            if (!busy) {
              // Act on the row that has keyboard focus first; the open card is
              // only a fallback. That lets a keyboard user triage rows without
              // opening each one.
              const target = visibleCards.find(card => card.id === focusedId)
                || visibleCards.find(card => card.id === selectedCardId);
              if (target && statusOf(target) === '待审阅') {
                if (event.key === 'a') {
                  event.preventDefault();
                  void review(target.id, 'approve');
                } else if (event.key === 'h') {
                  event.preventDefault();
                  void review(target.id, 'hold');
                } else if (event.key === 's') {
                  event.preventDefault();
                  void review(target.id, 'skip');
                }
              }
            }
          }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [busy, cardQuery, deleteArmed, digOpen, focusedId, libraryQuery, moveSelection, review, selectedCardId, tab, visibleCards]);

      if (!state) {
        return h('section', { className: 'kbw-page', ref: pageRef },
          h('style', null, CSS),
          h('div', { className: 'kbw-shell' },
            h('div', { className: 'kbw-head' },
              h('div', { className: 'kbw-head-main' },
                h('h1', { className: 'kbw-title' }, t('pageTitle')))),
            h('div', { className: 'kbw-loading' },
              error
                ? h(EmptyState, {
                    icon: 'alert',
                    title: t('loadFailed'),
                    hint: error,
                    action: h(Button, { onClick: () => { void load() } }, t('retry')),
                  })
                : h('div', { className: 'kbw-loading-rows' },
                    h(Skeleton, { width: 1, height: 1 }),
                    h(Skeleton, { width: 2, height: 1 }),
                    h(Skeleton, { width: 3, height: 1 }),
                    h(Skeleton, { width: 2, height: 1 })))));
      }

      const research = state.research || { available: true, enabled: false, time: '09:00', status: 'off' };
      const counts = state.counts || { pending: 0, hold: 0, skip: 0, inbox: 0, library: 0, followups: 0 };
      const briefCount = state.briefs ? state.briefs.length : 0;
      const queued = research.queued || null;
      const statusTone = queued ? 'accent' : !research.available ? 'warn' : research.enabled ? 'ok' : research.status === 'missing' ? 'warn' : 'off';
      const statusText = queued ? t('statusQueued')
        : !research.available ? t('statusUnavailable')
          : research.enabled ? t('statusOn')
            : research.status === 'missing' ? t('statusMissing') : t('statusOff');
      const statusDetail = queued ? t('queuedHint')
        : !research.available ? t('researchUnavailable')
          : research.enabled ? `${t('researchOn')} · ${research.time}`
            : research.status === 'missing' ? t('researchMissing') : t('researchOff');

      const topicList = String(form.topics || '').split(/[,，、;；]/).map(item => item.trim()).filter(Boolean);
      const tabCounts = {
        inbox: counts.pending,
        library: counts.library,
        research: briefCount,
        prefs: counts.followups,
      };
      const tabTitles = { inbox: 'tabInbox', library: 'tabLibrary', research: 'tabResearch', prefs: 'tabPrefs' };

      let lede = '';
      if (tab === 'inbox') {
        if (counts.pending) {
          lede = tf(counts.pending === 1 ? 'ledePendingOne' : 'ledePending', { n: counts.pending });
          if (counts.hold) lede += ` · ${tf(counts.hold === 1 ? 'ledeHoldOne' : 'ledeHold', { n: counts.hold })}`;
        } else if (counts.hold) {
          lede = tf(counts.hold === 1 ? 'ledeHoldOne' : 'ledeHold', { n: counts.hold });
        } else {
          lede = t('ledePendingZero');
        }
        lede += ` · ${tf(counts.library === 1 ? 'ledeLibraryOne' : 'ledeLibrary', { n: counts.library })}`;
      } else if (tab === 'library') {
        lede = tf(counts.library === 1 ? 'ledeLibraryOnlyOne' : 'ledeLibraryOnly', { n: counts.library });
      } else if (tab === 'research') {
        lede = queued
          ? tf('queuedAt', { time: formatMoment(queued.scheduledAt, state.date) })
          : research.enabled
            ? tf('ledeResearchOn', {
                time: research.time || '09:00',
                next: research.nextRunAt ? formatMoment(research.nextRunAt, state.date) : t('never'),
              })
            : t('ledeResearchOff');
      } else {
        lede = topicList.length || counts.followups
          ? tf('ledePrefs', { topics: topicList.length, n: counts.followups })
          : t('ledePrefsEmpty');
      }

      function renderSearch(value, onChange, placeholder, label) {
        return h('div', { className: 'kbw-search' },
          h(Icon, { name: 'search', size: 14, className: 'kbw-search-icon' }),
          h('input', {
            ref: searchRef,
            type: 'search',
            className: 'kbw-search-input',
            'aria-label': label || placeholder,
            placeholder,
            value,
            onChange: event => onChange(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Escape' && value) {
                event.stopPropagation();
                onChange('');
              }
            },
          }),
          value
            ? h(IconButton, { name: 'x', size: 13, label: t('clearSearch'), className: 'kbw-search-clear', onClick: () => onChange('') })
            : h('span', { className: 'kbw-search-kbd', 'aria-hidden': true }, h(Kbd, null, '/')));
      }

      function renderFilters() {
        return h('div', { className: 'kbw-filters', role: 'group' },
          FILTERS.map(value => {
            const count = value === 'pending' ? counts.pending
              : value === 'all' ? counts.inbox
                : value === 'hold' ? counts.hold : counts.skip;
            if (value !== 'pending' && value !== 'all' && count === 0 && cardFilter !== value) return null;
            return h('button', {
              key: value,
              type: 'button',
              className: 'kbw-filter',
              'data-active': cardFilter === value,
              'aria-pressed': cardFilter === value,
              onClick: () => { setCardFilter(value) },
            },
              t({ pending: 'filterPending', all: 'filterAll', hold: 'filterHold', skip: 'filterSkip' }[value]),
              h('span', { className: 'kbw-filter-count' }, String(count)));
          }));
      }

      function onRowKeyDown(event, id) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        const ids = visibleCards.map(card => card.id);
        const position = ids.indexOf(id);
        if (position < 0) return;
        let next = position;
        if (event.key === 'ArrowDown') next = Math.min(ids.length - 1, position + 1);
        else if (event.key === 'ArrowUp') next = Math.max(0, position - 1);
        else if (event.key === 'Home') next = 0;
        else next = ids.length - 1;
        const target = ids[next];
        if (target === id) return;
        void openCard(target);
        const row = rowRefs.current[target];
        if (row) {
          row.focus({ preventScroll: true });
          row.scrollIntoView({ block: 'nearest' });
        }
      }

      function renderCardList() {
        if (!visibleCards.length) {
          const searching = cardQuery.trim() !== '';
          return h(EmptyState, {
            compact: true,
            icon: searching ? 'search' : 'inbox',
            title: searching ? t('emptySearch') : cardFilter === 'all' ? t('emptyInbox') : t('emptyFilter'),
            hint: searching ? t('emptySearchHint') : cardFilter === 'all' ? t('emptyInboxHint') : t('emptyFilterHint'),
            action: searching
              ? h(Button, { small: true, onClick: () => setCardQuery('') }, t('clearSearch'))
              : cardFilter === 'all' ? h(Button, { small: true, onClick: () => { void researchAction('start', {}, 'runQueued') }, disabled: busy || !research.available || Boolean(queued) }, t('runNow')) : null,
          });
        }
        return h('ul', { className: 'kbw-rows', 'aria-label': t('tabInbox') },
          visibleCards.map(card => {
            const waiting = statusOf(card) === '待审阅';
            return h('li', { key: card.id },
              h('div', {
                className: 'kbw-row',
                'data-active': selectedCardId === card.id,
                'data-focused': focusedId === card.id,
                'data-state': waiting ? 'pending' : 'settled',
                onBlur: event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null);
                },
              },
                h('button', {
                  type: 'button',
                  className: 'kbw-row-main',
                  ref: element => {
                    if (element) rowRefs.current[card.id] = element;
                    else delete rowRefs.current[card.id];
                  },
                  'aria-current': selectedCardId === card.id ? 'true' : undefined,
                  onClick: () => { void openCard(card.id) },
                  onFocus: () => setFocusedId(card.id),
                  onKeyDown: event => onRowKeyDown(event, card.id),
                },
                  h('span', { className: 'kbw-row-title' }, card.title),
                  card.excerpt ? h('span', { className: 'kbw-row-excerpt' }, card.excerpt) : null,
                  h('span', { className: 'kbw-row-meta' },
                    waiting ? null : h(Chip, { tone: statusOf(card) === '已入库' ? 'ok' : undefined }, t(REVIEW_LABEL[statusOf(card)] || 'statusPending')),
                    h('span', { className: 'kbw-row-date' }, relativeDay(card.created, state.date, t, tf)),
                    (card.tags || []).slice(0, 2).map(tag => h('span', { className: 'kbw-row-tag', key: tag }, `#${tag}`)))),
                h('div', { className: 'kbw-row-actions' },
                  waiting
                    ? h(IconButton, {
                        name: 'check',
                        size: 15,
                        tone: 'ok',
                        label: `${t('reviewApprove')} (a)`,
                        disabled: busy,
                        onClick: event => { event.stopPropagation(); void review(card.id, 'approve') },
                      })
                    : h(IconButton, {
                        name: 'restore',
                        size: 14,
                        label: t('reviewRestore'),
                        disabled: busy,
                        onClick: event => { event.stopPropagation(); void review(card.id, 'pending') },
                      }),
                  waiting ? h(IconButton, {
                    name: 'hold',
                    size: 14,
                    label: `${t('reviewHold')} (h)`,
                    disabled: busy,
                    onClick: event => { event.stopPropagation(); void review(card.id, 'hold') },
                  }) : null,
                  waiting ? h(IconButton, {
                    name: 'skip',
                    size: 14,
                    label: `${t('reviewSkip')} (s)`,
                    disabled: busy,
                    onClick: event => { event.stopPropagation(); void review(card.id, 'skip') },
                  }) : null)));
          }));
      }

      function renderCardDetail() {
        if (!selectedCardId) {
          return h(EmptyState, {
            icon: 'inbox',
            title: t('selectCard'),
            hint: t('selectCardHint'),
          });
        }
        if (cardLoading) return h('div', { className: 'kbw-detail-scroll' }, renderReaderSkeleton());
        if (cardError) {
          return h(EmptyState, {
            icon: 'alert',
            title: t('loadFailed'),
            hint: cardError,
            action: h(Button, { small: true, onClick: () => { void openCard(selectedCardId) } }, t('retry')),
          });
        }
        if (!cardBody) return h('div', { className: 'kbw-detail-scroll' }, renderReaderSkeleton());
        const card = cardBody;
        const status = statusOf(card);
        const waiting = status === '待审阅' || status === '';
        const deleting = deleteArmed === card.id;
        const tone = waiting ? 'warn' : status === '已入库' ? 'ok' : undefined;
        return h(React.Fragment, null,
          h('div', { className: 'kbw-detail-head' },
            h('button', {
              type: 'button',
              className: 'kbw-back',
              onClick: () => { setSelectedCardId(null); setCardBody(null) },
            }, h(Icon, { name: 'left', size: 15 }), t('back')),
            h('h2', { className: 'kbw-detail-title' }, card.title),
            h('div', { className: 'kbw-detail-meta' },
              h(Chip, { tone }, t(REVIEW_LABEL[status] || 'statusPending')),
              card.meta && card.meta.created ? h('span', null, `${t('createdLabel')} ${card.meta.created}`) : null,
              (card.tags || []).map(tag => h('span', { className: 'kbw-row-tag', key: tag }, `#${tag}`))),
            deleting
              ? h('div', { className: 'kbw-confirm', role: 'group', 'aria-label': t('deleteConfirm') },
                  h('span', { className: 'kbw-confirm-text' }, h(Icon, { name: 'alert', size: 14 }), t('deleteWarning')),
                  h('div', { className: 'kbw-form-row' },
                    h(Button, { variant: 'danger', small: true, autoFocus: true, disabled: busy, onClick: () => { void review(card.id, 'delete') } }, t('deleteConfirm')),
                    h(Button, {
                      variant: 'ghost',
                      small: true,
                      onClick: () => {
                        setDeleteArmed(null);
                        const trigger = document.getElementById('kbw-delete-trigger');
                        if (trigger) trigger.focus();
                      },
                    }, t('cancel'))))
              : h('div', { className: 'kbw-actions' },
                  waiting
                    ? h(React.Fragment, null,
                        h(Button, { variant: 'primary', small: true, disabled: busy, onClick: () => { void review(card.id, 'approve') } }, h(Icon, { name: 'check', size: 14 }), t('reviewApprove')),
                        h(Button, { small: true, disabled: busy, onClick: () => { void review(card.id, 'hold') } }, t('reviewHold')),
                        h(Button, { small: true, disabled: busy, onClick: () => { void review(card.id, 'skip') } }, t('reviewSkip')))
                    : h(Button, { small: true, disabled: busy, onClick: () => { void review(card.id, 'pending') } }, h(Icon, { name: 'restore', size: 14 }), t('reviewRestore')),
                  h('div', { className: 'kbw-actions-end' },
                    h(Button, { variant: 'ghost', small: true, disabled: busy || !waiting, onClick: () => setDigOpen(value => !value) }, h(Icon, { name: 'spark', size: 14 }), t('digButton')),
                    h(IconButton, {
                      id: 'kbw-delete-trigger',
                      name: 'trash',
                      size: 14,
                      tone: 'danger',
                      label: t('reviewDelete'),
                      disabled: busy,
                      onClick: () => setDeleteArmed(card.id),
                    }))),
            h('p', { className: 'kbw-note-line' },
              h(Icon, { name: 'info', size: 13 }),
              h('span', null, waiting ? t('reviewHint') : t('restoreHint'))),
            digOpen ? h('div', { className: 'kbw-dig' },
              h('textarea', {
                className: 'kbw-textarea',
                'aria-label': t('digPlaceholder'),
                placeholder: t('digPlaceholder'),
                value: digQuestion,
                autoFocus: true,
                onChange: event => setDigQuestion(event.target.value),
                onKeyDown: event => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    setDigOpen(false);
                    setDigQuestion('');
                    return;
                  }
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void submitDig();
                  }
                },
              }),
              h('div', { className: 'kbw-form-row' },
                h(Button, { variant: 'primary', small: true, disabled: busy || !digQuestion.trim(), onClick: () => { void submitDig() } }, t('digSubmit')),
                h(Button, { variant: 'ghost', small: true, onClick: () => { setDigOpen(false); setDigQuestion('') } }, t('digCancel')))) : null),
          h('div', { className: 'kbw-detail-scroll', ref: readerRef },
            h(Markdown, { text: stripLeadingTitle(card.body, card.title), prefix: `card-${card.id}` }),
            h('div', { className: 'kbw-pathbar' },
              h('span', { className: 'kbw-pathbar-label' }, t('notePath')),
              h('code', { title: card.absolute || card.path }, card.path),
              h(Button, { variant: 'ghost', small: true, onClick: () => { void copyText(card.absolute || card.path) } }, copied === (card.absolute || card.path) ? t('copied') : t('copyPath')))));
      }

      function renderLibrary() {
        return h('div', { className: 'kbw-split', 'data-detail': Boolean(selectedNoteId) },
          h('div', { className: 'kbw-list-pane' },
            h('div', { className: 'kbw-tools' }, renderSearch(libraryQuery, setLibraryQuery, t('librarySearchPlaceholder'), t('librarySearchPlaceholder'))),
            h('div', { className: 'kbw-list' },
              !visibleLibrary.length
                ? h(EmptyState, {
                    compact: true,
                    icon: libraryQuery.trim() ? 'search' : 'library',
                    title: libraryQuery.trim() ? t('emptySearch') : t('emptyLibrary'),
                    hint: libraryQuery.trim() ? t('emptySearchHint') : t('emptyLibraryHint'),
                    footnote: libraryQuery.trim() ? null : t('basesHint'),
                    action: libraryQuery.trim() ? h(Button, { small: true, onClick: () => setLibraryQuery('') }, t('clearSearch')) : null,
                  })
                : h('ul', { className: 'kbw-rows', 'aria-label': t('tabLibrary') },
                    visibleLibrary.map(note => h('li', { key: note.id },
                      h('div', { className: 'kbw-row', 'data-active': selectedNoteId === note.id },
                        h('button', {
                          type: 'button',
                          className: 'kbw-row-main',
                          'aria-current': selectedNoteId === note.id ? 'true' : undefined,
                          onClick: () => { void openNote(note.id) },
                        },
                          h('span', { className: 'kbw-row-title' }, note.title),
                          note.excerpt ? h('span', { className: 'kbw-row-excerpt' }, note.excerpt) : null,
                          h('span', { className: 'kbw-row-meta' },
                            h('span', { className: 'kbw-row-date' }, relativeDay(note.created, state.date, t, tf)),
                            (note.tags || []).slice(0, 2).map(tag => h('span', { className: 'kbw-row-tag', key: tag }, `#${tag}`)))))))))),
          h('div', { className: 'kbw-detail-pane' },
            !selectedNoteId
              ? h(EmptyState, { icon: 'library', title: t('selectNote'), hint: t('selectNoteHint') })
              : noteLoading
                ? h('div', { className: 'kbw-detail-scroll' }, renderReaderSkeleton())
                : noteError
                  ? h(EmptyState, {
                      icon: 'alert',
                      title: t('loadFailed'),
                      hint: noteError,
                      action: h(Button, { small: true, onClick: () => { void openNote(selectedNoteId) } }, t('retry')),
                    })
                  : noteBody
                    ? h(React.Fragment, null,
                        h('div', { className: 'kbw-detail-head' },
                          h('button', {
                            type: 'button',
                            className: 'kbw-back',
                            onClick: () => { setSelectedNoteId(null); setNoteBody(null) },
                          }, h(Icon, { name: 'left', size: 15 }), t('back')),
                          h('h2', { className: 'kbw-detail-title' }, noteBody.title),
                          h('div', { className: 'kbw-detail-meta' },
                            noteBody.meta && noteBody.meta.created ? h('span', null, `${t('createdLabel')} ${noteBody.meta.created}`) : null,
                            (noteBody.tags || []).map(tag => h('span', { className: 'kbw-row-tag', key: tag }, `#${tag}`)))),
                        h('div', { className: 'kbw-detail-scroll', ref: readerRef },
                          h(Markdown, { text: stripLeadingTitle(noteBody.body, noteBody.title), prefix: `note-${noteBody.id}` }),
                          h('div', { className: 'kbw-pathbar' },
                            h('span', { className: 'kbw-pathbar-label' }, t('notePath')),
                            h('code', { title: noteBody.readPath || noteBody.path }, noteBody.path),
                            h(Button, { variant: 'ghost', small: true, onClick: () => { void copyText(noteBody.readPath || noteBody.path) } }, copied === (noteBody.readPath || noteBody.path) ? t('copied') : t('copyPath')))))
                    : null));
      }

      function renderResearch() {
        const nextRun = research.nextRunAt ? formatMoment(research.nextRunAt, state.date) : t('never');
        const lastRun = research.lastDelivery && research.lastDelivery.at ? formatMoment(research.lastDelivery.at, state.date) : t('never');
        const timeDirty = researchTime !== (research.time || '09:00');
        const briefList = !briefCount
          ? h(EmptyState, { compact: true, icon: 'compass', title: t('emptyBriefs'), hint: t('emptyBriefsHint') })
          : h('ul', { className: 'kbw-rows', 'aria-label': t('briefsTitle') },
              state.briefs.map(brief => {
                const active = selectedBriefDate === brief.date;
                return h('li', { key: brief.date },
                  h('div', { className: 'kbw-row', 'data-active': active },
                    h('button', {
                      type: 'button',
                      className: 'kbw-row-main',
                      'aria-current': active ? 'true' : undefined,
                      onClick: () => { void openBrief(brief.date) },
                    },
                      h('span', { className: 'kbw-row-title' }, brief.title),
                      brief.focus ? h('span', { className: 'kbw-row-excerpt' }, brief.focus) : null,
                      h('span', { className: 'kbw-row-meta' },
                        h('span', { className: 'kbw-row-date' }, relativeDay(brief.date, state.date, t, tf))))));
              }));
        return h('div', { className: 'kbw-split kbw-research', 'data-detail': Boolean(selectedBriefDate) },
          h('div', { className: 'kbw-list-pane kbw-rail' },
            h('div', { className: 'kbw-rail-block' },
              h('div', { className: 'kbw-rail-title' },
                h('span', { className: 'kbw-rail-heading' },
                  t('researchTitle'),
                  h('span', { className: 'kbw-rail-state' }, research.enabled ? t('researchOn') : t('researchOff'))),
                h(Switch, {
                  checked: Boolean(research.enabled),
                  disabled: busy || !research.available,
                  label: t('researchTitle'),
                  onChange: () => {
                    if (research.enabled) void researchAction('disable', {}, 'disableToast');
                    else void researchAction('enable', { time: researchTime }, 'enableToast');
                  },
                })),
              research.available
                ? h('div', { className: 'kbw-form-row' },
                    h('input', {
                      className: 'kbw-input kbw-time',
                      type: 'time',
                      value: researchTime,
                      'aria-label': t('dailyTime'),
                      onChange: event => setResearchTime(event.target.value),
                    }),
                    timeDirty
                      ? h(Button, { variant: 'primary', small: true, disabled: busy, onClick: () => { void researchAction('save-time', { time: researchTime }, 'timeSavedToast') } }, t('saveTime'))
                      : null)
                : h('p', { className: 'kbw-hint kbw-hint--warn' }, t('researchUnavailable')),
              queued
                ? h('p', { className: 'kbw-hint kbw-hint--queued' },
                    h(Icon, { name: 'spark', size: 12 }),
                    h('span', null, `${tf('queuedAt', { time: formatMoment(queued.scheduledAt, state.date) })} · ${t('queuedHint')}`))
                : null,
              h('dl', { className: 'kbw-facts' },
                h('dt', null, t('nextRun')),
                h('dd', null, research.enabled ? nextRun : t('never')),
                h('dt', null, t('lastRun')),
                h('dd', null, lastRun)),
              h('p', { className: 'kbw-hint' }, t('researchHint'))),
            h('div', { className: 'kbw-rail-block kbw-rail-block--list' },
              h('div', { className: 'kbw-rail-title' },
                h('span', null, t('briefsTitle')),
                h('span', { className: 'kbw-rail-count' }, String(briefCount))),
              h('p', { className: 'kbw-hint' }, t('briefsHint'))),
            h('div', { className: 'kbw-list kbw-rail-list' }, briefList)),
          h('div', { className: 'kbw-detail-pane' },
            !selectedBriefDate
              ? h(EmptyState, { icon: 'compass', title: t('selectBrief'), hint: t('selectBriefHint') })
              : briefLoading
                ? h('div', { className: 'kbw-detail-scroll' }, renderReaderSkeleton())
                : briefError
                  ? h(EmptyState, {
                      icon: 'alert',
                      title: t('loadFailed'),
                      hint: briefError,
                      action: h(Button, { small: true, onClick: () => { void openBrief(selectedBriefDate) } }, t('retry')),
                    })
                  : briefBody
                    ? h(React.Fragment, null,
                        h('div', { className: 'kbw-detail-head' },
                          h('button', {
                            type: 'button',
                            className: 'kbw-back',
                            onClick: () => { setSelectedBriefDate(null); setBriefBody(null) },
                          }, h(Icon, { name: 'left', size: 15 }), t('back')),
                          h('h2', { className: 'kbw-detail-title' }, briefBody.title),
                          h('div', { className: 'kbw-detail-meta' },
                            h(Chip, null, briefBody.date),
                            state.date === briefBody.date ? h('span', null, t('today')) : null)),
                        h('div', { className: 'kbw-detail-scroll', ref: readerRef },
                          h(Markdown, { text: briefBody.body, prefix: `brief-${briefBody.date}` }),
                          h('div', { className: 'kbw-pathbar' },
                            h('span', { className: 'kbw-pathbar-label' }, t('notePath')),
                            h('code', null, briefBody.path),
                            h(Button, { variant: 'ghost', small: true, onClick: () => { void copyText(briefBody.absolute || briefBody.path) } }, copied === (briefBody.absolute || briefBody.path) ? t('copied') : t('copyPath')))))
                    : null));
      }

      function renderPreferences() {
        const cleanTopic = value => String(value || '').trim();
        return h('div', { className: 'kbw-columns' },
          h('section', { className: 'kbw-section' },
            h('div', { className: 'kbw-section-head' },
              h('h2', { className: 'kbw-section-title' }, t('prefsTitle')),
              formDirty ? h('span', { className: 'kbw-unsaved' }, h(Dot, { tone: 'warn' }), t('unsaved')) : null),
            h('p', { className: 'kbw-section-hint' }, t('prefsHint')),
            h('div', { className: 'kbw-form' },
              h('label', { className: 'kbw-field' },
                h('span', null, t('prefsTopics')),
                h('input', {
                  className: 'kbw-input',
                  value: form.topics,
                  onChange: event => updateForm('topics', event.target.value),
                }),
                h('span', { className: 'kbw-field-hint' }, t('prefsTopicsHint')),
                topicList.length
                  ? h('span', { className: 'kbw-taglist' }, topicList.map((topic, index) => h('span', { className: 'kbw-tag', key: `${topic}-${index}` },
                      `#${topic}`,
                      h('button', {
                        type: 'button',
                        'aria-label': `${t('remove')} ${topic}`,
                        onClick: () => {
                          const next = topicList.filter((item, itemIndex) => itemIndex !== index);
                          updateForm('topics', next.join(', '));
                        },
                      }, h(Icon, { name: 'x', size: 11 })))))
                  : null),
              h('div', { className: 'kbw-form-grid' },
                h('label', { className: 'kbw-field' },
                  h('span', null, t('prefsLevel')),
                  h('input', { className: 'kbw-input', value: form.level, onChange: event => updateForm('level', event.target.value) })),
                h('label', { className: 'kbw-field' },
                  h('span', null, t('prefsGoal')),
                  h('textarea', { className: 'kbw-textarea', value: form.goal, onChange: event => updateForm('goal', event.target.value) }))),
              h('label', { className: 'kbw-field' },
                h('span', null, t('prefsStyle')),
                h('textarea', { className: 'kbw-textarea', value: form.style, onChange: event => updateForm('style', event.target.value) })),
              h('label', { className: 'kbw-field' },
                h('span', null, t('prefsAvoid')),
                h('textarea', { className: 'kbw-textarea', value: form.avoid, onChange: event => updateForm('avoid', event.target.value) }))),
            h('div', { className: 'kbw-form-row kbw-form-actions' },
              h(Button, { variant: 'primary', disabled: busy || !formDirty, onClick: () => { void savePreferences() } }, t('savePrefs')))),
          h('section', { className: 'kbw-section' },
            h('div', { className: 'kbw-section-head' },
              h('h2', { className: 'kbw-section-title' }, t('questionsTitle')),
              h('span', { className: 'kbw-section-count' }, String((state.followups || []).length))),
            h('div', { className: 'kbw-form-row kbw-form-row--inline' },
              h('input', {
                className: 'kbw-input',
                'aria-label': t('questionPlaceholder'),
                placeholder: t('questionPlaceholder'),
                value: questionDraft,
                onChange: event => setQuestionDraft(event.target.value),
                onKeyDown: event => {
                  if (event.key !== 'Enter') return;
                  if (event.nativeEvent && (event.nativeEvent.isComposing || event.keyCode === 229)) return;
                  event.preventDefault();
                  void addQuestion();
                },
              }),
              h(Button, { disabled: busy || !cleanTopic(questionDraft), onClick: () => { void addQuestion() } }, t('addQuestion'))),
            (state.followups || []).length === 0
              ? h(EmptyState, { compact: true, icon: 'compass', title: t('emptyQuestions'), hint: t('emptyQuestionsHint') })
              : h('div', { className: 'kbw-qlist' },
                  state.followups.map(item => h('div', { className: 'kbw-q', key: item.id },
                    h('p', null, item.question),
                    h(IconButton, {
                      name: 'x',
                      size: 13,
                      label: t('remove'),
                      disabled: busy,
                      onClick: async () => { await act('followup/remove', { id: item.id }) },
                    }))))));
      }

      function renderReaderSkeleton() {
        return h('div', { className: 'kbw-skel' },
          h(Skeleton, { width: 2, height: 2 }),
          h(Skeleton, { width: 1, height: 1 }),
          h(Skeleton, { width: 1, height: 1 }),
          h('div', { className: 'kbw-skel-gap' }),
          h(Skeleton, { width: 2, height: 1 }),
          h(Skeleton, { width: 1, height: 1 }),
          h(Skeleton, { width: 3, height: 1 }));
      }

      function renderWelcome() {
        const vaultPath = state.config ? state.config.vault : state.vault;
        const steps = [
          ['initStepResearch', 'initStepResearchHint'],
          ['initStepReview', 'initStepReviewHint'],
          ['initStepPublish', 'initStepPublishHint'],
        ].map(([titleKey, hintKey], index) => h('div', { className: 'kbw-step', key: titleKey },
          h('span', { className: 'kbw-step-index' }, String(index + 1)),
          h('b', null, t(titleKey)),
          h('span', null, t(hintKey))));
        return h('div', { className: 'kbw-welcome' },
          h('div', { className: 'kbw-welcome-inner' },
            h('span', { className: 'kbw-welcome-icon' }, h(BookIcon, { size: 22 })),
            h('h2', { className: 'kbw-welcome-title' }, t('initTitle')),
            h('p', { className: 'kbw-welcome-body' }, t('initBody')),
            h('div', { className: 'kbw-welcome-path' },
              h('span', { className: 'kbw-pathbar-label' }, t('initPath')),
              h('code', null, vaultPath)),
            h('div', { className: 'kbw-welcome-actions' },
              h(Button, {
                variant: 'primary',
                disabled: busy,
                onClick: async () => {
                  const data = await act('init', {});
                  if (!data) return;
                  notify(t('saved'));
                  await load();
                },
              }, t('initAction')),
              h(Button, {
                variant: 'ghost',
                onClick: () => { void copyText(vaultPath) },
              }, copied ? t('copied') : t('copyPath'))),
            h('div', { className: 'kbw-steps' }, steps)));
      }

      function renderFooter() {
        const vaultPath = state.config ? state.config.vault : state.vault;
        const basePath = state.paths && state.paths.base ? state.paths.base : '';
        return h('footer', { className: 'kbw-footer' },
          h('div', { className: 'kbw-footer-inner' },
            h('span', { className: 'kbw-footer-label' }, t('vaultLabel')),
            h('code', { title: vaultPath }, basename(vaultPath)),
            h(IconButton, {
              name: copied === vaultPath ? 'check' : 'copy',
              size: 13,
              label: copied === vaultPath ? t('copied') : t('copyPath'),
              onClick: () => { void copyText(vaultPath) },
            }),
            basePath
              ? h(React.Fragment, null,
                  h('span', { className: 'kbw-sep', 'aria-hidden': true }),
                  h('span', { className: 'kbw-footer-label', title: t('basesHint') }, t('basesLabel')),
                  h('code', { title: basePath }, basename(basePath)),
                  h(IconButton, {
                    name: copied === basePath ? 'check' : 'copy',
                    size: 13,
                    label: copied === basePath ? t('copied') : t('copyPath'),
                    onClick: () => { void copyText(basePath) },
                  }))
              : null,
            h('div', { className: 'kbw-footer-spacer' }),
            h('div', { className: 'kbw-shortcuts' },
              tab === 'inbox'
                ? h(React.Fragment, null,
                    h('span', { className: 'kbw-shortcut' }, h(Kbd, null, 'j'), h(Kbd, null, 'k'), h('span', null, t('shortcutMoveLabel'))),
                    h('span', { className: 'kbw-shortcut' }, h(Kbd, null, 'a'), h('span', null, t('reviewApprove'))),
                    h('span', { className: 'kbw-shortcut' }, h(Kbd, null, 'h'), h('span', null, t('reviewHold'))),
                    h('span', { className: 'kbw-shortcut' }, h(Kbd, null, 's'), h('span', null, t('reviewSkip'))),
                    h('span', { className: 'kbw-shortcut' }, h(Kbd, null, 'Esc'), h('span', null, t('shortcutCancelLabel'))),
                    h('span', { className: 'kbw-shortcut' }, h(Kbd, null, '/'), h('span', null, t('shortcutSearchLabel'))))
                : tab === 'library'
                  ? h('span', { className: 'kbw-shortcut' }, h(Kbd, null, '/'), h('span', null, t('shortcutSearchLabel')))
                  : null)));
      }

      if (!state.initialized) {
        return h('section', { className: 'kbw-page', ref: pageRef },
          h('style', null, CSS),
          h('div', { className: 'kbw-shell' },
            h('div', { className: 'kbw-head' },
              h('div', { className: 'kbw-head-main' },
                h('h1', { className: 'kbw-title' }, t('pageTitle'))),
              h('div', { className: 'kbw-head-actions' },
                h(Button, { variant: 'ghost', onClick: () => { void load() }, disabled: busy }, h(Icon, { name: 'refresh', size: 14 }), t('refresh')))),
            error ? h('div', { className: 'kbw-alert', role: 'alert' },
              h(Icon, { name: 'alert', size: 15 }),
              h('span', { className: 'kbw-alert-text' }, error),
              h(IconButton, { name: 'x', size: 13, label: t('close'), onClick: () => setError('') })) : null,
            renderWelcome()),
          toast ? renderToast() : null);
      }

      const body = tab === 'inbox'
        ? h('div', { className: 'kbw-split', 'data-detail': Boolean(selectedCardId) },
            h('div', { className: 'kbw-list-pane' },
              h('div', { className: 'kbw-tools' },
                renderSearch(cardQuery, setCardQuery, t('searchPlaceholder'), t('searchPlaceholder')),
                renderFilters()),
              h('div', { className: 'kbw-list' }, renderCardList())),
            h('div', { className: 'kbw-detail-pane' }, renderCardDetail()))
        : tab === 'library'
          ? renderLibrary()
          : tab === 'research'
            ? renderResearch()
            : renderPreferences();

      function renderToast() {
        const tone = toast.tone || 'ok';
        return h('div', { className: 'kbw-toasts' },
          h('div', { className: 'kbw-toast', 'data-tone': tone, role: 'status', 'aria-live': 'polite', key: toast.id },
            h(Icon, { name: tone === 'warn' ? 'info' : 'check', size: 14 }),
            h('span', null, toast.text)));
      }

      return h('section', {
        className: 'kbw-page',
        ref: pageRef,
        'aria-busy': busy ? 'true' : undefined,
      },
        h('style', null, CSS),
        h('div', { className: 'kbw-shell' },
          h('div', { className: 'kbw-head' },
            h('div', { className: 'kbw-head-main' },
              h('h1', { className: 'kbw-title' }, t('pageTitle')),
              h('p', { className: 'kbw-lede' },
                h('span', null, `${state.date} ${t(weekdayKey(state.date))}`),
                h('span', { className: 'kbw-sep-dot', 'aria-hidden': true }, '·'),
                h('span', null, lede))),
            h('div', { className: 'kbw-head-actions' },
              h('button', {
                type: 'button',
                className: 'kbw-status',
                title: statusDetail,
                onClick: () => setTab('research'),
              },
                h(Dot, { tone: statusTone === 'accent' || statusTone === 'ok' || statusTone === 'warn' ? statusTone : undefined }),
                h('span', null, statusText),
                research.enabled && !queued && research.time ? h('span', { className: 'kbw-status-time' }, research.time) : null),
              h(IconButton, {
                name: 'refresh',
                size: 15,
                label: t('refreshHint'),
                className: busy ? 'kbw-spin' : undefined,
                disabled: busy,
                onClick: () => { void load() },
              }),
              h(Button, {
                variant: 'primary',
                disabled: busy || !research.available || Boolean(queued),
                title: queued ? t('statusQueued') : t('runNowHint'),
                onClick: () => { void researchAction('start', {}, 'runQueued') },
              }, h(Icon, { name: 'spark', size: 14 }), t('runNow')))),
          h('div', { className: 'kbw-nav', role: 'tablist', 'aria-label': t('ariaTabs') },
            TABS.map(id => h('button', {
              key: id,
              type: 'button',
              role: 'tab',
              id: `kbw-tab-${id}`,
              className: 'kbw-tab',
              'aria-selected': tab === id,
              'aria-controls': `kbw-panel-${id}`,
              tabIndex: tab === id ? 0 : -1,
              onClick: () => { setTab(id) },
              onKeyDown: event => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                const position = TABS.indexOf(tab);
                const next = TABS[(position + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
                setTab(next);
                const target = document.getElementById(`kbw-tab-${next}`);
                if (target) target.focus();
              },
            },
              t(tabTitles[id]),
              tabCounts[id] ? h('span', { className: 'kbw-tab-count' }, String(tabCounts[id])) : null))),
          error ? h('div', { className: 'kbw-alert', role: 'alert' },
            h(Icon, { name: 'alert', size: 15 }),
            h('span', { className: 'kbw-alert-text' }, error),
            h(IconButton, { name: 'x', size: 13, label: t('close'), onClick: () => setError('') })) : null,
          h('div', {
            className: 'kbw-body',
            id: `kbw-panel-${tab}`,
            role: 'tabpanel',
            'aria-labelledby': `kbw-tab-${tab}`,
          }, body)),
        renderFooter(),
        toast ? renderToast() : null);
    }

    /* -------------------------------------------------------------- */
    /* Styles                                                          */
    /* -------------------------------------------------------------- */

    const CSS = `
.kbw-page{
  --kbw-line:var(--dsw-alias-border-l1);
  --kbw-line-2:var(--dsw-alias-border-l2);
  --kbw-ink:var(--dsw-alias-label-primary);
  --kbw-ink-2:var(--dsw-alias-label-secondary);
  --kbw-ink-3:var(--dsw-alias-label-tertiary);
  --kbw-hover:var(--dsw-alias-interactive-bg-hover);
  --kbw-active:var(--dsw-alias-interactive-bg-active);
  --kbw-accent:var(--dsw-alias-state-business-primary);
  --kbw-danger:var(--dsw-alias-state-error-primary);
  --kbw-warn:var(--dsw-alias-state-warn-primary);
  --kbw-warn-label:var(--dsw-alias-state-warn-label);
  --kbw-ok:var(--dsw-alias-state-success-primary);
  --kbw-body-size:14px;
  --kbw-small-size:13px;
  --kbw-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  position:relative;display:flex;flex-direction:column;height:100%;max-height:100dvh;min-height:0;
  overflow:auto;background:var(--dsw-alias-bg-base);color:var(--kbw-ink);
  font-family:inherit;font-size:var(--kbw-small-size);line-height:1.55;
  -webkit-font-smoothing:antialiased;box-sizing:border-box
}
.kbw-page *,.kbw-page *::before,.kbw-page *::after{box-sizing:border-box}
:where(.kbw-page) :where(button, input, textarea){font:inherit;color:inherit}
.kbw-page ::selection{background:var(--dsw-alias-bg-document-selection)}
.kbw-shell{flex:1;min-height:0;display:flex;flex-direction:column;width:100%;max-width:1040px;margin:0 auto;padding:0 clamp(20px,4vw,48px)}

/* header and tabs follow the host plugin page: 20/500 title, 13px intro, a
   0.5px hairline, and an underline tab strip 44px tall */
.kbw-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:28px 0 0;margin-bottom:18px}
.kbw-head-main{min-width:0;display:flex;flex-direction:column}
.kbw-dot{flex:none;width:5px;height:5px;border-radius:50%;background:var(--kbw-ink-3);display:inline-block}
.kbw-dot[data-tone="ok"]{background:var(--kbw-ok)}
.kbw-dot[data-tone="warn"]{background:var(--kbw-warn)}
.kbw-dot[data-tone="accent"]{background:var(--dsw-alias-state-business-primary)}
.kbw-title{margin:0;font-size:20px;font-weight:500;line-height:28px;letter-spacing:0}
.kbw-lede{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:4px 0 0;font-size:13px;line-height:20px;color:var(--kbw-ink-2);text-wrap:pretty}
.kbw-sep-dot{color:var(--kbw-ink-3)}
.kbw-head-actions{flex:none;display:flex;align-items:center;gap:6px}
.kbw-status{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 4px;border:0;border-radius:5px;background:transparent;color:var(--kbw-ink-2);font-size:13px;cursor:pointer;white-space:nowrap;transition:background .14s,color .14s}
.kbw-status:hover{background:var(--kbw-hover);color:var(--kbw-ink)}
.kbw-status-time{font-variant-numeric:tabular-nums;color:var(--kbw-ink-3);font-size:12px}
.kbw-sep{width:1px;height:10px;background:var(--kbw-line-2);display:inline-block;flex:none}

/* tabs */
.kbw-nav{flex:none;display:flex;align-items:flex-end;gap:36px;height:44px;border-bottom:.5px solid var(--dsw-alias-border-l3);overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.kbw-tab{position:relative;flex:none;display:inline-flex;align-items:center;gap:6px;padding:0 0 13px;border:0;background:none;color:var(--kbw-ink-3);font-size:13px;font-weight:500;line-height:16px;cursor:pointer;white-space:nowrap;transition:color .13s}
.kbw-tab::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px;background:transparent}
.kbw-tab:hover{color:var(--kbw-ink)}
.kbw-tab[aria-selected="true"]{color:var(--dsw-alias-state-business-primary)}
.kbw-tab[aria-selected="true"]::after{background:var(--dsw-alias-state-business-primary)}
.kbw-tab-count{font-size:11px;color:var(--kbw-ink-3);font-variant-numeric:tabular-nums;min-width:10px;text-align:center}
.kbw-tab[aria-selected="true"] .kbw-tab-count{color:inherit;opacity:.7}
.kbw-tab:focus-visible,.kbw-btn:focus-visible,.kbw-iconbtn:focus-visible,.kbw-status:focus-visible,.kbw-row-main:focus-visible,.kbw-filter:focus-visible,.kbw-back:focus-visible,.kbw-switch:focus-visible{
  outline:2px solid color-mix(in srgb,var(--kbw-accent) 45%,transparent);outline-offset:1px
}
.kbw-tab:focus-visible{outline-offset:-3px;border-radius:4px}
.kbw-row-main:focus-visible{outline-offset:-2px}

/* body + panes */
.kbw-body{flex:1;min-height:0;display:flex;flex-direction:column}
.kbw-split{flex:1;min-height:0;display:grid;grid-template-columns:minmax(268px,330px) minmax(0,1fr);gap:0}
.kbw-research{grid-template-columns:minmax(244px,310px) minmax(0,1fr)}
.kbw-list-pane{display:flex;flex-direction:column;min-height:0;min-width:0;border-right:.5px solid var(--dsw-alias-border-l3)}
.kbw-detail-pane{display:flex;flex-direction:column;min-width:0;min-height:0}
.kbw-loading{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 0}
.kbw-loading-rows{width:min(420px,80%);display:flex;flex-direction:column;gap:10px}

/* list tools */
.kbw-tools{flex:none;display:flex;flex-direction:column;gap:9px;padding:12px 12px 10px}
.kbw-search{position:relative;display:flex;align-items:center}
.kbw-search-icon{position:absolute;left:9px;color:var(--kbw-ink-3);pointer-events:none}
.kbw-search-input{width:100%;height:32px;padding:0 30px 0 29px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:transparent;color:var(--kbw-ink);font-size:12.5px;outline:none;transition:border-color .14s,background .14s}
.kbw-search-input::placeholder{color:var(--kbw-ink-3)}
.kbw-search-input:hover{border-color:var(--dsw-alias-border-l4)}
.kbw-search-input:focus-visible{border-color:var(--kbw-line-2);background:var(--kbw-hover);outline:2px solid color-mix(in srgb,var(--kbw-accent) 38%,transparent);outline-offset:-1px}
.kbw-search-input::-webkit-search-cancel-button{display:none}
.kbw-search-kbd{position:absolute;right:8px;pointer-events:none;display:inline-flex}
.kbw-search-clear{position:absolute;right:4px;width:22px;height:22px;border-radius:5px}
.kbw-filters{display:flex;gap:3px;flex-wrap:wrap}
.kbw-filter{display:inline-flex;align-items:center;gap:5px;height:23px;padding:0 8px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--kbw-ink-3);font-size:11px;cursor:pointer;transition:background .13s,color .13s,border-color .13s}
.kbw-filter:hover{background:var(--kbw-hover);color:var(--kbw-ink-2)}
.kbw-filter[data-active="true"]{background:var(--kbw-active);border-color:var(--dsw-alias-border-l3);color:var(--kbw-ink)}
.kbw-filter-count{font-variant-numeric:tabular-nums;opacity:.75}

/* list */
.kbw-list{flex:1;min-height:0;overflow:auto;padding:0 8px 14px;scrollbar-width:thin;scrollbar-gutter:stable;scrollbar-color:var(--dsw-alias-scrollbar-bg-l1) transparent}
.kbw-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.kbw-row{display:flex;align-items:stretch;border-radius:9px;transition:background .12s}
.kbw-row:hover{background:var(--kbw-hover)}
.kbw-row[data-active="true"]{background:var(--kbw-active)}
.kbw-row[data-focused="true"]:not([data-active="true"]){background:var(--kbw-hover)}
.kbw-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;padding:10px 4px 10px 10px;border:0;border-radius:9px;background:transparent;text-align:left;cursor:pointer}
.kbw-row[data-active="true"] .kbw-row-main{box-shadow:inset 2px 0 0 var(--kbw-ink)}
.kbw-row[data-focused="true"] .kbw-row-main{box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary)}
.kbw-row-title{font-size:12.8px;font-weight:600;line-height:1.45;color:var(--kbw-ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty;overflow-wrap:anywhere}
.kbw-row[data-state="settled"] .kbw-row-title{color:var(--kbw-ink-2)}
.kbw-row-excerpt{margin:0;font-size:11.7px;line-height:1.5;color:var(--kbw-ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.kbw-row-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:15px;font-size:10.5px;color:var(--kbw-ink-3)}
.kbw-row-date{font-variant-numeric:tabular-nums}
.kbw-row-tag{color:var(--kbw-ink-3);overflow-wrap:anywhere}
.kbw-row-actions{flex:none;display:flex;align-items:center;gap:0;padding:0 4px 0 0}
.kbw-row-actions .kbw-iconbtn{opacity:.7;transition:opacity .13s,background .13s,color .13s}
.kbw-row-actions .kbw-iconbtn:disabled{opacity:.35}
.kbw-row:hover .kbw-iconbtn,.kbw-row[data-active="true"] .kbw-iconbtn,.kbw-row[data-focused="true"] .kbw-iconbtn,.kbw-row .kbw-iconbtn:focus-visible{opacity:1}

/* detail */
.kbw-detail-head{flex:0 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:7px;padding:16px 24px 12px;border-bottom:.5px solid var(--dsw-alias-border-l3);scrollbar-width:thin}
.kbw-back{display:none;align-items:center;gap:2px;height:22px;margin-left:-5px;padding:0 6px 0 2px;border:0;border-radius:5px;background:transparent;color:var(--kbw-ink-2);font-size:11.5px;cursor:pointer}
.kbw-back:hover{background:var(--kbw-hover);color:var(--kbw-ink)}
.kbw-detail-title{margin:0;font-size:18.5px;font-weight:650;line-height:1.35;letter-spacing:-.006em;text-wrap:pretty;overflow-wrap:anywhere}
.kbw-detail-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:10.8px;color:var(--kbw-ink-3)}
.kbw-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding-top:2px}
.kbw-actions-end{margin-left:auto;display:flex;align-items:center;gap:4px}
.kbw-detail-scroll{flex:1;min-height:0;overflow:auto;padding:20px 24px 56px;scrollbar-width:thin;scrollbar-gutter:stable;scrollbar-color:var(--dsw-alias-scrollbar-bg-l1) transparent}
.kbw-note-line{display:flex;align-items:flex-start;gap:5px;margin:0;padding-top:1px;font-size:10.8px;line-height:1.5;color:var(--kbw-ink-3)}
.kbw-note-line svg{flex:none;margin-top:1px}
.kbw-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between;padding:7px 9px;border:1px solid color-mix(in srgb,var(--kbw-danger) 38%,var(--kbw-line));border-radius:8px;background:color-mix(in srgb,var(--kbw-danger) 7%,transparent)}
.kbw-confirm-text{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--kbw-danger);min-width:0}
.kbw-confirm-text svg{flex:none}
.kbw-dig{display:flex;flex-direction:column;gap:6px;padding-top:4px}

/* text */
.kbw-md{max-width:70ch;font-size:var(--kbw-body-size);line-height:1.75;color:var(--kbw-ink);overflow-wrap:anywhere}
.kbw-md>*:first-child{margin-top:0}
.kbw-md>*:last-child{margin-bottom:0}
.kbw-md p{margin:0 0 .85em;text-wrap:pretty}
.kbw-md h2,.kbw-md h3,.kbw-md h4,.kbw-md h5{margin:1.55em 0 .5em;line-height:1.4;font-weight:650;letter-spacing:-.003em;text-wrap:pretty}
.kbw-md h2{font-size:1.22em}
.kbw-md h3{font-size:1.02em}
.kbw-md h4,.kbw-md h5{font-size:.96em;color:var(--kbw-ink-2)}
.kbw-md ul,.kbw-md ol{margin:.45em 0 .95em;padding-left:1.35em}
.kbw-md li{margin:.2em 0;text-wrap:pretty}
.kbw-md li::marker{color:var(--kbw-ink-3)}
.kbw-md ol>li::marker{font-variant-numeric:tabular-nums}
.kbw-md blockquote{margin:1em 0;padding:8px 12px;border-left:2px solid var(--kbw-accent);border-radius:0 7px 7px 0;background:var(--kbw-hover);color:var(--kbw-ink-2);font-size:.96em}
.kbw-md blockquote p{margin:0 0 .5em}
.kbw-md blockquote p:last-child{margin-bottom:0}
.kbw-md code{font-family:var(--kbw-mono);font-size:.88em;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-markdown-inline-code)}
.kbw-md pre{margin:1em 0;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-markdown-code-block);overflow:auto}
.kbw-md pre code{padding:0;background:none;font-size:.86em;line-height:1.65}
.kbw-md a{color:var(--dsw-alias-link);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-link) 32%,transparent)}
.kbw-md a:hover{border-bottom-color:currentColor}
.kbw-md hr{margin:1.8em 0;border:0;border-top:1px solid var(--kbw-line)}
.kbw-md table{width:100%;margin:1em 0;border-collapse:collapse;font-size:.94em}
.kbw-md th,.kbw-md td{padding:6px 10px;border-bottom:1px solid var(--kbw-line);vertical-align:top;text-align:left}
.kbw-md th{font-weight:600;font-size:.92em;color:var(--kbw-ink-2)}
.kbw-md img{max-width:100%;height:auto;border-radius:6px}
.kbw-md .kbw-align-center{text-align:center}
.kbw-md .kbw-align-right{text-align:right}

/* path bar */
.kbw-pathbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:32px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2);font-size:10.8px;color:var(--kbw-ink-3)}
.kbw-pathbar-label{color:var(--kbw-ink-3)}
.kbw-pathbar code{font-family:var(--kbw-mono);color:var(--kbw-ink-2);overflow-wrap:anywhere;min-width:0}

/* empty + skeleton */
.kbw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;padding:26px 22px;color:var(--kbw-ink-2);min-width:0}
.kbw-empty--fill{flex:1;min-height:0}
.kbw-empty--compact{align-items:flex-start;text-align:left;padding:22px 14px}
.kbw-empty-icon{display:inline-flex;margin-bottom:2px;color:var(--kbw-ink-3)}
.kbw-empty b{font-size:13px;font-weight:600;color:var(--kbw-ink)}
.kbw-empty p{margin:0;font-size:11.5px;line-height:1.6;max-width:36ch;text-wrap:pretty}
.kbw-empty-footnote{font-size:10.5px;line-height:1.55;color:var(--kbw-ink-3);max-width:40ch;padding-top:6px;border-top:.5px solid var(--kbw-line-2);text-align:inherit}
.kbw-empty-actions{display:flex;gap:6px;margin-top:5px;flex-wrap:wrap}
.kbw-skeleton{display:block;height:12px;width:100%;border-radius:6px;background:var(--dsw-alias-bg-skeleton);animation:kbw-pulse 1.7s ease-in-out infinite}
.kbw-skeleton[data-w="1"]{width:100%}
.kbw-skeleton[data-w="2"]{width:72%}
.kbw-skeleton[data-w="3"]{width:46%}
.kbw-skeleton[data-h="1"]{height:11px}
.kbw-skeleton[data-h="2"]{height:22px;border-radius:7px}
.kbw-skel{display:flex;flex-direction:column;gap:11px;max-width:70ch}
.kbw-skel-gap{height:16px}
@keyframes kbw-pulse{0%,100%{opacity:.45}50%{opacity:.9}}
@keyframes kbw-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes kbw-spin{to{transform:rotate(360deg)}}

/* controls */
.kbw-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:29px;padding:0 11px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:transparent;color:var(--kbw-ink);font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background .14s,border-color .14s,color .14s,transform .06s}
.kbw-btn:hover:not(:disabled){background:var(--kbw-hover);border-color:var(--dsw-alias-border-l4)}
.kbw-btn:active:not(:disabled){transform:translateY(1px)}
.kbw-btn:disabled{opacity:.42;cursor:default}
.kbw-btn--primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.kbw-btn--primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover);border-color:transparent}
.kbw-btn--ghost{border-color:transparent;color:var(--kbw-ink-2)}
.kbw-btn--ghost:hover:not(:disabled){background:var(--kbw-hover);border-color:transparent;color:var(--kbw-ink)}
.kbw-btn--danger{justify-content:center;border-color:color-mix(in srgb,var(--kbw-danger) 40%,transparent);background:transparent;color:var(--kbw-danger)}
.kbw-btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--kbw-danger) 10%,transparent);border-color:color-mix(in srgb,var(--kbw-danger) 55%,transparent)}
.kbw-btn--sm{height:25px;padding:0 8px;border-radius:6px;font-size:11.5px;gap:4px}
.kbw-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--kbw-ink-2);cursor:pointer;transition:background .13s,color .13s}
.kbw-iconbtn:hover:not(:disabled){background:var(--kbw-hover);color:var(--kbw-ink)}
.kbw-iconbtn:disabled{opacity:.35;cursor:default}
.kbw-iconbtn--ok:hover:not(:disabled){color:var(--kbw-ok)}
.kbw-iconbtn--danger:hover:not(:disabled){color:var(--kbw-danger);background:var(--dsw-alias-interactive-bg-hover-danger)}
.kbw-spin svg{animation:kbw-spin .9s linear infinite}
.kbw-chip{display:inline-flex;align-items:center;gap:4px;height:19px;padding:0 6px;border-radius:5px;background:var(--kbw-hover);color:var(--kbw-ink-2);font-size:10.3px;font-weight:500;white-space:nowrap}
.kbw-chip[data-tone="warn"]{background:color-mix(in srgb,var(--kbw-warn) 10%,transparent)}
.kbw-chip[data-tone="ok"]{background:color-mix(in srgb,var(--kbw-ok) 10%,transparent)}
.kbw-chip .kbw-dot{width:5px;height:5px}
.kbw-kbd{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border:.5px solid var(--dsw-alias-border-l3);border-radius:4px;background:var(--kbw-hover);color:var(--kbw-ink-2);font-family:var(--kbw-mono);font-size:9.5px;line-height:1}
.kbw-input,.kbw-textarea{width:100%;min-width:0;padding:6px 9px;border:.5px solid var(--dsw-alias-border-l4);border-radius:7px;background:transparent;color:var(--kbw-ink);font-size:12.5px;outline:none;transition:border-color .14s,background .14s}
.kbw-input{height:31px}
.kbw-textarea{min-height:62px;resize:vertical;line-height:1.6}
.kbw-input:hover,.kbw-textarea:hover{border-color:var(--dsw-alias-border-l4)}
.kbw-input:focus-visible,.kbw-textarea:focus-visible{border-color:var(--kbw-line-2);background:var(--kbw-hover);outline:2px solid color-mix(in srgb,var(--kbw-accent) 36%,transparent);outline-offset:-1px}
.kbw-time{width:110px;flex:none}
.kbw-switch{position:relative;flex:none;width:36px;height:20px;padding:0;border:0;border-radius:999px;background:var(--dsw-alias-border-l3);cursor:pointer;transition:background .15s}
.kbw-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);transition:transform .16s}
.kbw-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.kbw-switch[aria-checked="true"]::after{transform:translateX(16px)}
.kbw-switch:disabled{opacity:.5;cursor:default}

/* research rail */
.kbw-rail{background:transparent}
.kbw-rail-block{flex:none;display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-bottom:1px solid var(--kbw-line)}
.kbw-rail-block--list{border-bottom:0;padding-bottom:6px;gap:4px}
.kbw-rail-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:600;color:var(--kbw-ink)}
.kbw-rail-heading{display:inline-flex;align-items:baseline;gap:8px;min-width:0}
.kbw-rail-state{font-size:11px;font-weight:400;color:var(--kbw-ink-3);white-space:nowrap}
.kbw-rail-count{font-size:10.5px;font-weight:500;color:var(--kbw-ink-3);font-variant-numeric:tabular-nums}
.kbw-rail-list{flex:1;min-height:0;padding-top:0}
.kbw-facts{display:grid;grid-template-columns:auto 1fr;gap:1px 10px;margin:0;font-size:10.8px;color:var(--kbw-ink-2)}
.kbw-facts dt{color:var(--kbw-ink-3)}
.kbw-facts dd{margin:0;font-variant-numeric:tabular-nums}
.kbw-hint{margin:0;font-size:10.8px;line-height:1.55;color:var(--kbw-ink-3);text-wrap:pretty}
.kbw-hint--warn{color:var(--kbw-warn-label)}
.kbw-hint--queued{display:flex;align-items:flex-start;gap:5px;color:var(--kbw-ink-2)}
.kbw-hint--queued svg{flex:none;margin-top:2px;color:var(--kbw-accent)}

/* prefs */
.kbw-columns{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:30px;align-content:start;padding:18px 0 48px;scrollbar-width:thin}
.kbw-section{display:flex;flex-direction:column;gap:13px;min-width:0}
.kbw-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.kbw-section-title{margin:0;font-size:13px;font-weight:600}
.kbw-section-hint{margin:0;font-size:11px;line-height:1.6;color:var(--kbw-ink-3)}
.kbw-section-count{font-size:10.5px;color:var(--kbw-ink-3);font-variant-numeric:tabular-nums}
.kbw-unsaved{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--kbw-warn-label)}
.kbw-form{display:flex;flex-direction:column;gap:11px}
.kbw-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;align-items:start}
.kbw-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.kbw-field>span{font-size:11px;font-weight:500;color:var(--kbw-ink-2)}
.kbw-field-hint{font-size:10.3px;color:var(--kbw-ink-3)}
.kbw-form-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.kbw-form-row--inline .kbw-input{flex:1 1 160px;width:auto}
.kbw-form-actions{padding-top:3px}
.kbw-taglist{display:flex;gap:4px;flex-wrap:wrap;margin-top:1px}
.kbw-tag{display:inline-flex;align-items:center;gap:2px;height:19px;padding:0 2px 0 6px;border-radius:5px;background:var(--kbw-hover);color:var(--kbw-ink-2);font-size:10.3px}
.kbw-tag button{display:grid;place-items:center;width:14px;height:14px;padding:0;border:0;border-radius:3px;background:transparent;color:var(--kbw-ink-3);cursor:pointer}
.kbw-tag button:hover{background:var(--kbw-active);color:var(--kbw-ink)}
.kbw-qlist{display:flex;flex-direction:column}
.kbw-q{display:flex;align-items:flex-start;gap:8px;padding:7px 2px;border-bottom:1px solid var(--kbw-line);font-size:12px;line-height:1.55}
.kbw-q:last-child{border-bottom:0}
.kbw-q p{flex:1;min-width:0;margin:0;text-wrap:pretty;overflow-wrap:anywhere}
.kbw-q .kbw-iconbtn{opacity:.45;flex:none}
.kbw-q:hover .kbw-iconbtn{opacity:1}

/* welcome */
.kbw-welcome{flex:1;min-height:0;display:flex;justify-content:center;padding:24px 0 48px;overflow:auto}
.kbw-welcome-inner{width:100%;max-width:520px;display:flex;flex-direction:column;gap:12px}
.kbw-welcome-icon{display:inline-flex;color:var(--kbw-ink-3)}
.kbw-welcome-title{margin:0;font-size:20px;font-weight:500;line-height:28px}
.kbw-welcome-body{margin:0;font-size:13px;line-height:20px;color:var(--kbw-ink-2);text-wrap:pretty}
.kbw-welcome-path{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--kbw-ink-3)}
.kbw-welcome-path code{font-family:var(--kbw-mono);color:var(--kbw-ink-2);overflow-wrap:anywhere}
.kbw-welcome-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:4px}
.kbw-steps{display:flex;flex-direction:column;margin-top:20px;border-top:.5px solid var(--dsw-alias-border-l3)}
.kbw-step{display:flex;align-items:baseline;gap:14px;padding:11px 0;border-bottom:.5px solid var(--kbw-line-2)}
.kbw-step:last-child{border-bottom:0}
.kbw-step-index{flex:none;width:12px;font-size:11px;font-variant-numeric:tabular-nums;color:var(--kbw-ink-3)}
.kbw-step b{flex:none;font-size:13px;font-weight:500;min-width:56px}
.kbw-step span:last-child{font-size:12px;line-height:18px;color:var(--kbw-ink-3);text-wrap:pretty}

/* alert + toast + footer */
.kbw-alert{flex:none;display:flex;align-items:center;gap:8px;margin-top:10px;padding:7px 8px 7px 11px;border:1px solid color-mix(in srgb,var(--kbw-danger) 40%,var(--kbw-line));border-radius:8px;background:color-mix(in srgb,var(--kbw-danger) 7%,transparent);color:var(--kbw-danger);font-size:11.5px}
.kbw-alert svg{flex:none}
.kbw-alert-text{flex:1;min-width:0;overflow-wrap:anywhere}
.kbw-alert .kbw-iconbtn{color:inherit;flex:none}
.kbw-toasts{position:absolute;right:24px;bottom:48px;z-index:40;display:flex;flex-direction:column;gap:6px;align-items:flex-end;pointer-events:none}
.kbw-toast{display:flex;align-items:center;gap:7px;max-width:min(520px,80vw);padding:8px 12px;border-radius:8px;background:var(--dsw-alias-toast-bg);color:var(--dsw-alias-toast-label);font-size:12px;line-height:18px;animation:kbw-in .16s ease-out;pointer-events:auto}
.kbw-toast[data-tone="warn"]{color:var(--dsw-alias-state-warn-secondary)}
.kbw-toast svg{flex:none}
.kbw-footer{flex:none;padding:6px 0;border-top:.5px solid var(--dsw-alias-border-l3)}
.kbw-footer-inner{display:flex;align-items:center;gap:5px;width:100%;max-width:1040px;margin:0 auto;padding:0 clamp(20px,4vw,48px);font-size:10.5px;color:var(--kbw-ink-3);min-width:0}
.kbw-footer-label{white-space:nowrap}
.kbw-footer code{font-family:var(--kbw-mono);color:var(--kbw-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:22ch}
.kbw-footer .kbw-iconbtn{width:20px;height:20px;border-radius:4px}
.kbw-footer-spacer{flex:1;min-width:8px}
.kbw-shortcuts{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.kbw-shortcut{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}

@media (max-width:1120px){
  .kbw-columns{grid-template-columns:minmax(0,1fr);gap:30px}
}
@media (max-width:960px){
  .kbw-shortcuts{display:none}
  .kbw-status-time{display:none}
}
@media (max-width:840px){
  .kbw-split{grid-template-columns:minmax(0,1fr)}
  .kbw-list-pane{border-right:0}
  .kbw-split[data-detail="true"] .kbw-list-pane{display:none}
  .kbw-split[data-detail="false"] .kbw-detail-pane{display:none}
  .kbw-back{display:inline-flex}
  .kbw-detail-head{padding:12px 16px 10px}
  .kbw-detail-scroll{padding:16px 16px 48px}
  .kbw-head{flex-wrap:wrap;gap:10px;padding-top:18px;margin-bottom:14px}
  .kbw-head-actions{width:100%;justify-content:flex-start}
  .kbw-head-actions .kbw-btn--primary{margin-left:auto}
  .kbw-nav{gap:24px}
  .kbw-status{display:none}
  .kbw-columns{padding:16px 0 40px}
  .kbw-form-grid{grid-template-columns:minmax(0,1fr)}
  .kbw-welcome-inner{padding:0}
  .kbw-footer code{max-width:14ch}
}
@media (prefers-reduced-motion:reduce){
  .kbw-page *,.kbw-page *::before,.kbw-page *::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}
}
`;

    /* -------------------------------------------------------------- */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'knowledge-workbench: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 5,
          locale: NS,
          label: () => t('panel'),
        }, BookIcon));
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, WorkbenchPage));
      },
    };
  },
});
