/**
 * Structural checks for concept articles. These checks cannot verify a fetched
 * page or judge whether a claim is true; evidence and editorial review remain
 * explicit research steps. Inputs without article fields use the legacy path.
 */

/** Reject oversized fields instead of silently cutting off an explanation. */
function field(value, name, limit, required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new Error(`卡片缺少「${name}」`);
  if (result.length > limit) throw new Error(`「${name}」过长，最多 ${limit} 字，请编辑后重试`);
  return result;
}

/** A valid type is mandatory whenever any of the new article fields is used. */
export function normalizeArticle(input) {
  const keys = ['type', 'question', 'definition', 'mechanism', 'subjects', 'comparison', 'evidenceNote', 'reviewNote'];
  if (!keys.some(key => Object.hasOwn(input, key))) return null;
  if (!['concept', 'comparison'].includes(input.type)) throw new Error('卡片类型必须是 concept 或 comparison');
  const article = {
    type: input.type,
    title: field(input.title, '标题', 120),
    takeaway: field(input.takeaway, '核心认识', 240),
    question: field(input.question, '研究问题', 400),
    definition: field(input.definition, '概念定义', 2400),
    mechanism: field(input.mechanism, '机制解释', 4000),
    limits: field(input.limits, '边界与取舍', 1800),
    evidenceNote: field(input.evidenceNote, '证据与不确定性', 1200),
    reviewNote: field(input.reviewNote, '审读记录', 800),
    related: field(input.related, '关联', 800, false),
  };
  if (article.type === 'comparison') {
    if (!Array.isArray(input.subjects) || input.subjects.length !== 2) throw new Error('概念比较需要恰好两个比较对象');
    article.subjects = input.subjects.map(value => field(value, '比较对象', 80));
    if (article.subjects[0].normalize('NFKC').toLowerCase() === article.subjects[1].normalize('NFKC').toLowerCase()) {
      throw new Error('比较对象不能相同');
    }
    if (!Array.isArray(input.comparison) || input.comparison.length < 2 || input.comparison.length > 6) {
      throw new Error('概念比较需要 2–6 个共同维度');
    }
    article.comparison = input.comparison.map(row => ({
      dimension: field(row?.dimension, '比较维度', 80),
      left: field(row?.left, '左侧概念解释', 500),
      right: field(row?.right, '右侧概念解释', 500),
      implication: field(row?.implication, '差异的影响', 500),
    }));
    const dimensions = article.comparison.map(row => row.dimension.normalize('NFKC').toLowerCase());
    if (new Set(dimensions).size !== dimensions.length) throw new Error('比较维度不能重复');
  } else if (input.subjects !== undefined || input.comparison !== undefined) {
    throw new Error('比较对象和维度仅用于 comparison 类型');
  }
  if (!Array.isArray(input.sources) || !input.sources.length || input.sources.length > 5) {
    throw new Error('卡片需要 1–5 条原文来源与引文');
  }
  article.sources = input.sources.map(source => {
    let url;
    try {
      url = new URL(field(source?.url, '来源链接', 2048));
    } catch {
      throw new Error('来源链接必须是完整的 http(s) 地址');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('来源链接必须是无账号密码的 http(s) 地址');
    }
    const quote = field(source?.quote, '来源引文', 600);
    if (quote.length < 8) throw new Error('来源引文太短，请摘录原文');
    return {
      url: url.href,
      title: field(source?.title, '来源标题', 200),
      quote,
      supports: field(source?.supports, '引文支撑的具体论断', 300),
    };
  });
  const urls = article.sources.map(source => {
    const url = new URL(source.url);
    url.hash = '';
    return url.href;
  });
  if (new Set(urls).size !== urls.length) throw new Error('来源链接重复，请合并同一原文的证据');
  if (article.type === 'comparison' && article.sources.length < 2) throw new Error('概念比较至少需要两条不同的原文来源，覆盖双方论断');
  return article;
}
