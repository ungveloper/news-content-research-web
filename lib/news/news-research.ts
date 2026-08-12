import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_IDS,
  getBlogCategory,
  type BlogCategoryId,
} from "@/lib/categories";
import {
  getNaverApiMode,
  getNaverAutocompleteSuggestions,
  getNaverSearchTrends,
  searchNaverBlogs,
  searchNaverNews,
  type NaverNewsItem,
} from "@/lib/news/naver-api";
import {
  buildCompetitionSignal,
  calculatePreliminaryScore,
  emptyCompetitionSignal,
  stripHtml,
  tokenSimilarity,
  tokenize,
} from "@/lib/news/scoring";
import type {
  AutocompleteSignal,
  CategorySelection,
  CompetitionSignal,
  NewsArticleSummary,
  NewsOpportunity,
  NewsResearchResponse,
  SearchTrendSignal,
} from "@/lib/types";

type SeedDefinition = {
  keyword: string;
  categoryId: BlogCategoryId;
};

type CollectedArticle = NewsArticleSummary & {
  categoryId: BlogCategoryId;
  publishedTimestamp: number;
};

type ArticleCluster = {
  articles: CollectedArticle[];
  titleTokens: Set<string>;
};

const ACTION_WORDS = [
  "변경",
  "개편",
  "시행",
  "확정",
  "신청",
  "접수",
  "모집",
  "출시",
  "공개",
  "발표",
  "인상",
  "인하",
  "지원",
  "대상",
  "조건",
  "일정",
  "가격",
  "규제",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSeoulDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parsePublisher(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "출처 확인 필요";
  }
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) =>
      url.searchParams.delete(key),
    );
    return url.toString();
  } catch {
    return value;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
  return results;
}

function buildSeeds(
  categorySelection: CategorySelection,
  customSeeds: string[],
): SeedDefinition[] {
  const categories =
    categorySelection === "all"
      ? BLOG_CATEGORIES
      : [getBlogCategory(categorySelection)];
  const defaults = categories.flatMap((category) =>
    category.seedKeywords.map((keyword) => ({
      keyword,
      categoryId: category.id,
    })),
  );

  const guessCategoryForSeed = (keyword: string): BlogCategoryId => {
    if (categorySelection !== "all") return categorySelection;
    const normalized = keyword.toLocaleLowerCase("ko-KR");
    if (/(채용|시험|자격|취업|공무원|면접|인턴|직무)/.test(normalized)) return "career";
    if (/(금리|환율|코스피|주식|세금|대출|청약|연금|etf|부동산|투자)/i.test(normalized)) return "finance";
    if (/(ai|인공지능|챗gpt|반도체|보안|개인정보|스마트폰|아이폰|갤럭시|구글|네이버 ai|카카오 ai)/i.test(normalized)) return "it-ai";
    return "life";
  };
  const custom = customSeeds.slice(0, 8).map((keyword) => ({
    keyword,
    categoryId: guessCategoryForSeed(keyword),
  }));

  const seen = new Set<string>();
  return [...defaults, ...custom].filter((seed) => {
    const key = seed.keyword.toLocaleLowerCase("ko-KR");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isClusterMatch(cluster: ArticleCluster, article: CollectedArticle): boolean {
  const articleTokens = new Set(tokenize(article.title));
  if (articleTokens.size === 0) return false;

  let intersection = 0;
  for (const token of articleTokens) {
    if (cluster.titleTokens.has(token)) intersection += 1;
  }

  const smallerSize = Math.min(articleTokens.size, cluster.titleTokens.size);
  const overlapCoefficient = smallerSize > 0 ? intersection / smallerSize : 0;
  const representative = cluster.articles[0]?.title ?? "";
  const similarity = tokenSimilarity(representative, article.title);

  return similarity >= 0.42 || (intersection >= 3 && overlapCoefficient >= 0.5);
}

function clusterArticles(articles: CollectedArticle[]): ArticleCluster[] {
  const clusters: ArticleCluster[] = [];

  for (const article of articles) {
    const matched = clusters.find((cluster) => isClusterMatch(cluster, article));
    if (!matched) {
      clusters.push({
        articles: [article],
        titleTokens: new Set(tokenize(article.title)),
      });
      continue;
    }

    matched.articles.push(article);
    for (const token of tokenize(article.title)) matched.titleTokens.add(token);
  }

  return clusters;
}

function getDominantCategory(cluster: ArticleCluster): {
  categoryId: BlogCategoryId;
  categoryShare: number;
} {
  const counts = new Map<BlogCategoryId, number>();
  for (const article of cluster.articles) {
    counts.set(article.categoryId, (counts.get(article.categoryId) ?? 0) + 1);
  }

  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const categoryId = best?.[0] ?? BLOG_CATEGORIES[0].id;
  const count = best?.[1] ?? 1;
  return {
    categoryId,
    categoryShare: count / Math.max(cluster.articles.length, 1),
  };
}

function extractTopic(cluster: ArticleCluster): string {
  const tokenStats = new Map<string, { count: number; firstIndex: number }>();
  cluster.articles.forEach((article, articleIndex) => {
    const unique = new Set(tokenize(article.title));
    for (const token of unique) {
      const current = tokenStats.get(token) ?? { count: 0, firstIndex: articleIndex };
      current.count += 1;
      current.firstIndex = Math.min(current.firstIndex, articleIndex);
      tokenStats.set(token, current);
    }
  });

  const ranked = [...tokenStats.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].firstIndex - b[1].firstIndex)
    .map(([token]) => token)
    .filter((token) => !ACTION_WORDS.includes(token))
    .slice(0, 4);

  if (ranked.length >= 2) return ranked.join(" ");
  const representativeTokens = tokenize(cluster.articles[0]?.title ?? "").slice(0, 4);
  return representativeTokens.join(" ") || stripHtml(cluster.articles[0]?.title ?? "뉴스 이슈");
}

function deriveLongtail(topic: string, title: string, categoryId: BlogCategoryId): {
  longtailHint: string;
  secondQuestion: string;
} {
  const normalized = stripHtml(title);
  const hasAny = (...words: string[]) => words.some((word) => normalized.includes(word));

  if (hasAny("신청", "지원금", "지원", "접수", "모집")) {
    return {
      longtailHint: `${topic} 신청 대상 조건`,
      secondQuestion: "나는 대상인지, 언제부터 어떻게 신청해야 하는가?",
    };
  }
  if (hasAny("변경", "개편", "시행", "확정", "규제")) {
    return {
      longtailHint: `${topic} 변경 내용 적용 대상`,
      secondQuestion: "기존과 무엇이 달라지고 누구에게 언제부터 적용되는가?",
    };
  }
  if (hasAny("출시", "공개", "업데이트")) {
    return {
      longtailHint: `${topic} 출시일 가격 차이`,
      secondQuestion: "언제 이용할 수 있고 기존 제품·서비스와 무엇이 다른가?",
    };
  }
  if (categoryId === "career" || hasAny("시험", "합격", "면접", "채용")) {
    return {
      longtailHint: `${topic} 일정 준비사항`,
      secondQuestion: "다음 일정은 언제이며 지금 무엇을 준비해야 하는가?",
    };
  }
  if (categoryId === "finance" || hasAny("금리", "세금", "대출", "환율")) {
    return {
      longtailHint: `${topic} 영향 대응 방법`,
      secondQuestion: "내 돈과 조건에는 어떤 영향이 있고 무엇을 확인해야 하는가?",
    };
  }

  return {
    longtailHint: `${topic} 무엇이 달라지나`,
    secondQuestion: "뉴스 이후 실제 생활이나 선택에서 무엇이 달라지는가?",
  };
}

function getVelocityLabel(last1HourCount: number, last3HourCount: number, publisherCount: number) {
  if (last1HourCount >= 4 || (last3HourCount >= 8 && publisherCount >= 5)) return "급상승" as const;
  if (last3HourCount >= 4 || publisherCount >= 4) return "상승" as const;
  return "관찰" as const;
}


function toArticleSummary(article: CollectedArticle): NewsArticleSummary {
  return {
    title: article.title,
    description: article.description,
    url: article.url,
    originalUrl: article.originalUrl,
    publishedAt: article.publishedAt,
    publisher: article.publisher,
    matchedSeed: article.matchedSeed,
  };
}

function buildEmptyAutocomplete(
  query: string,
  status: "no-data" | "error" = "no-data",
): AutocompleteSignal {
  return {
    status,
    query,
    suggestions: [],
  };
}

function buildEmptyTrend(status: "no-data" | "error" = "no-data"): SearchTrendSignal {
  return {
    status,
    latestRatio: null,
    recentAverage: null,
    baselineAverage: null,
    momentumPercent: null,
    periodStart: null,
    periodEnd: null,
  };
}

async function enrichTrends(
  opportunities: NewsOpportunity[],
): Promise<Map<string, SearchTrendSignal>> {
  const target = opportunities.slice(0, 30);
  const map = new Map<string, SearchTrendSignal>();
  const endDate = toSeoulDateString(new Date());
  const startDate = toSeoulDateString(addDays(new Date(), -21));
  const batches: NewsOpportunity[][] = [];

  for (let index = 0; index < target.length; index += 5) {
    batches.push(target.slice(index, index + 5));
  }

  await mapWithConcurrency(batches, 3, async (batch) => {
    try {
      const response = await getNaverSearchTrends({
        startDate,
        endDate,
        keywordGroups: batch.map((item) => ({
          groupName: item.id,
          keywords: [item.searchKeyword],
        })),
      });

      for (const result of response.results ?? []) {
        const data = [...(result.data ?? [])].sort((a, b) => a.period.localeCompare(b.period));
        const ratios = data.map((point) => Number(point.ratio)).filter(Number.isFinite);
        if (ratios.length === 0) {
          map.set(result.title, buildEmptyTrend("no-data"));
          continue;
        }

        const recent = ratios.slice(-3);
        const baseline = ratios.slice(Math.max(0, ratios.length - 17), Math.max(0, ratios.length - 3));
        const recentAverage = average(recent);
        const baselineAverage = average(baseline);
        const momentumPercent =
          recentAverage !== null && baselineAverage !== null && baselineAverage > 0
            ? ((recentAverage - baselineAverage) / baselineAverage) * 100
            : recentAverage && recentAverage > 0
              ? 100
              : 0;

        map.set(result.title, {
          status: "ok",
          latestRatio: ratios.at(-1) ?? null,
          recentAverage: recentAverage === null ? null : Number(recentAverage.toFixed(2)),
          baselineAverage: baselineAverage === null ? null : Number(baselineAverage.toFixed(2)),
          momentumPercent: Number(clamp(momentumPercent, -100, 999).toFixed(1)),
          periodStart: data[0]?.period ?? startDate,
          periodEnd: data.at(-1)?.period ?? endDate,
        });
      }
    } catch {
      batch.forEach((item) => map.set(item.id, buildEmptyTrend("error")));
    }
  });

  for (const item of target) {
    if (!map.has(item.id)) map.set(item.id, buildEmptyTrend("no-data"));
  }
  return map;
}

async function enrichAutocomplete(
  opportunities: NewsOpportunity[],
): Promise<Map<string, AutocompleteSignal>> {
  const target = opportunities.slice(0, 30);
  const map = new Map<string, AutocompleteSignal>();

  await mapWithConcurrency(target, 3, async (item) => {
    try {
      const suggestions = await getNaverAutocompleteSuggestions(item.searchKeyword);
      map.set(item.id, {
        status: suggestions.length > 0 ? "ok" : "no-data",
        query: item.searchKeyword,
        suggestions,
      });
    } catch {
      map.set(item.id, buildEmptyAutocomplete(item.searchKeyword, "error"));
    }
  });

  return map;
}

async function enrichCompetition(
  opportunities: NewsOpportunity[],
): Promise<Map<string, CompetitionSignal>> {
  const target = opportunities.slice(0, 24);
  const map = new Map<string, CompetitionSignal>();

  await mapWithConcurrency(target, 5, async (item) => {
    try {
      const result = await searchNaverBlogs(item.longtailHint, 10);
      const signal = buildCompetitionSignal({
        query: item.longtailHint,
        blogResultTotal: result.total ?? 0,
        blogTitles: (result.items ?? []).map((entry) => stripHtml(entry.title)),
        articleCount: item.articleCount,
        publisherCount: item.independentPublisherCount,
        topic: item.topic,
      });
      map.set(item.id, signal);
    } catch {
      map.set(item.id, {
        ...emptyCompetitionSignal(item.longtailHint),
        status: "error",
      });
    }
  });

  return map;
}

function buildReasons(item: NewsOpportunity): string[] {
  const reasons: string[] = [];
  if (item.last1HourCount >= 3) reasons.push(`최근 1시간 기사 ${item.last1HourCount}건으로 뉴스 공급 속도가 빠릅니다.`);
  if (item.independentPublisherCount >= 4) reasons.push(`서로 다른 도메인 ${item.independentPublisherCount}곳에서 다뤄 단일 매체 이슈보다 확산 신호가 강합니다.`);
  if (item.trend.status === "ok" && (item.trend.momentumPercent ?? 0) > 20) reasons.push(`Naver 검색 추세 최근 평균이 기준 구간보다 ${Math.round(item.trend.momentumPercent ?? 0)}% 높습니다.`);
  if (item.autocomplete.status === "ok") reasons.push(`핵심 키워드 “${item.autocomplete.query}” 입력 시 Naver 자동완성 ${item.autocomplete.suggestions.length}개를 확보해 실제 검색 표현 후보로 사용할 수 있습니다.`);
  if (item.competition.status === "ok") reasons.push(`롱테일 힌트 기준 Naver 블로그 검색 경쟁 위험을 ${item.competition.riskLevel}(${item.competition.riskScore}/100)으로 사전 추정했습니다.`);
  reasons.push(`뉴스 자체 요약보다 “${item.secondQuestion}”라는 후속 검색 의도로 전환할 수 있습니다.`);
  return reasons.slice(0, 5);
}

export async function collectNewsOpportunities(input: {
  categorySelection: CategorySelection;
  windowHours: number;
  customSeeds: string[];
  maxResults: number;
}): Promise<NewsResearchResponse> {
  const now = Date.now();
  const seeds = buildSeeds(input.categorySelection, input.customSeeds);
  const windowHours = clamp(input.windowHours, 1 / 6, 48);
  const analysisWindowHours = Math.max(windowHours, 3);
  const detectionCutoff = now - windowHours * 60 * 60 * 1000;
  const analysisCutoff = now - analysisWindowHours * 60 * 60 * 1000;
  const warnings: string[] = [];
  let successfulSeedCount = 0;
  let failedSeedCount = 0;

  const seedResults = await mapWithConcurrency(seeds, 6, async (seed) => {
    try {
      const response = await searchNaverNews(seed.keyword, 30);
      successfulSeedCount += 1;
      return (response.items ?? []).map((item: NaverNewsItem) => ({ item, seed }));
    } catch (error) {
      failedSeedCount += 1;
      warnings.push(
        `${seed.keyword}: ${error instanceof Error ? error.message : "뉴스 검색 실패"}`,
      );
      return [];
    }
  });

  const rawRows = seedResults.flat();
  const deduplicated = new Map<string, CollectedArticle>();

  for (const { item, seed } of rawRows) {
    const timestamp = Date.parse(item.pubDate);
    if (!Number.isFinite(timestamp)) continue;

    const originalUrl = item.originallink || item.link;
    const article: CollectedArticle = {
      title: stripHtml(item.title),
      description: stripHtml(item.description ?? ""),
      url: item.link,
      originalUrl,
      publishedAt: new Date(timestamp).toISOString(),
      publisher: parsePublisher(originalUrl),
      matchedSeed: seed.keyword,
      categoryId: seed.categoryId,
      publishedTimestamp: timestamp,
    };
    const key = normalizeUrl(originalUrl || item.link);
    const existing = deduplicated.get(key);
    if (!existing || existing.publishedTimestamp < article.publishedTimestamp) {
      deduplicated.set(key, article);
    }
  }

  const analysisArticles = [...deduplicated.values()]
    .filter(
      (article) =>
        article.publishedTimestamp >= analysisCutoff &&
        article.publishedTimestamp <= now + 5 * 60 * 1000,
    )
    .sort((a, b) => b.publishedTimestamp - a.publishedTimestamp);
  const recentArticles = analysisArticles.filter(
    (article) => article.publishedTimestamp >= detectionCutoff,
  );
  const clusters = clusterArticles(analysisArticles).filter((cluster) =>
    cluster.articles.some(
      (article) => article.publishedTimestamp >= detectionCutoff,
    ),
  );

  let candidates: NewsOpportunity[] = clusters
    .filter((cluster) => {
      const publishers = new Set(cluster.articles.map((article) => article.publisher));
      const title = cluster.articles[0]?.title ?? "";
      return cluster.articles.length >= 2 || publishers.size >= 2 || ACTION_WORDS.some((word) => title.includes(word));
    })
    .map((cluster, index) => {
      const sorted = [...cluster.articles].sort((a, b) => b.publishedTimestamp - a.publishedTimestamp);
      const representative = sorted[0];
      const publisherCount = new Set(sorted.map((article) => article.publisher)).size;
      const last1HourCount = sorted.filter((article) => now - article.publishedTimestamp <= 60 * 60 * 1000).length;
      const last3HourCount = sorted.filter((article) => now - article.publishedTimestamp <= 3 * 60 * 60 * 1000).length;
      const last6HourCount = sorted.filter((article) => now - article.publishedTimestamp <= 6 * 60 * 60 * 1000).length;
      const dominant = getDominantCategory(cluster);
      const category = getBlogCategory(dominant.categoryId);
      const topic = extractTopic(cluster);
      const derived = deriveLongtail(topic, representative.title, dominant.categoryId);
      const ageMinutes = Math.max(0, Math.round((now - representative.publishedTimestamp) / 60000));
      const matchedSeeds = [...new Set(sorted.map((article) => article.matchedSeed))];
      const placeholderCompetition = emptyCompetitionSignal(derived.longtailHint);
      const placeholderTrend = buildEmptyTrend();
      const preliminary = calculatePreliminaryScore({
        last1HourCount,
        last3HourCount,
        last6HourCount,
        articleCount: sorted.length,
        publisherCount,
        ageMinutes,
        categoryShare: dominant.categoryShare,
        title: representative.title,
        category,
        trend: placeholderTrend,
        competition: placeholderCompetition,
      });

      return {
        id: `news-${index}-${Buffer.from(`${topic}-${representative.publishedAt}`).toString("base64url").slice(0, 10)}`,
        rank: index + 1,
        categoryId: dominant.categoryId,
        categoryLabel: category.label,
        topic,
        representativeTitle: representative.title,
        searchKeyword: topic,
        longtailHint: derived.longtailHint,
        secondQuestion: derived.secondQuestion,
        autocomplete: buildEmptyAutocomplete(topic),
        matchedSeeds,
        articleCount: sorted.length,
        independentPublisherCount: publisherCount,
        last1HourCount,
        last3HourCount,
        last6HourCount,
        newestPublishedAt: representative.publishedAt,
        oldestPublishedAt: sorted.at(-1)?.publishedAt ?? representative.publishedAt,
        ageMinutes,
        newsVelocityLabel: getVelocityLabel(last1HourCount, last3HourCount, publisherCount),
        trend: placeholderTrend,
        competition: placeholderCompetition,
        preliminaryAiScore: preliminary.score,
        scoreBreakdown: preliminary.breakdown,
        reasons: [],
        articles: sorted.slice(0, 8).map(toArticleSummary),
      } satisfies NewsOpportunity;
    })
    .sort(
      (a, b) =>
        b.preliminaryAiScore - a.preliminaryAiScore ||
        b.independentPublisherCount - a.independentPublisherCount ||
        a.ageMinutes - b.ageMinutes,
    )
    .slice(0, 36);

  const trendMap = await enrichTrends(candidates);
  candidates = candidates.map((item) => ({
    ...item,
    trend: trendMap.get(item.id) ?? buildEmptyTrend(),
  }));

  const autocompleteMap = await enrichAutocomplete(candidates);
  candidates = candidates.map((item) => ({
    ...item,
    autocomplete:
      autocompleteMap.get(item.id) ?? buildEmptyAutocomplete(item.searchKeyword),
  }));

  const competitionMap = await enrichCompetition(candidates);
  candidates = candidates.map((item) => {
    const category = getBlogCategory(item.categoryId);
    const competition = competitionMap.get(item.id) ?? emptyCompetitionSignal(item.longtailHint);
    const categoryShare = item.matchedSeeds.filter((seed) => category.seedKeywords.includes(seed)).length / Math.max(item.matchedSeeds.length, 1);
    const preliminary = calculatePreliminaryScore({
      last1HourCount: item.last1HourCount,
      last3HourCount: item.last3HourCount,
      last6HourCount: item.last6HourCount,
      articleCount: item.articleCount,
      publisherCount: item.independentPublisherCount,
      ageMinutes: item.ageMinutes,
      categoryShare: clamp(categoryShare || 0.72, 0.35, 1),
      title: item.representativeTitle,
      category,
      trend: item.trend,
      competition,
    });
    const updated = {
      ...item,
      competition,
      preliminaryAiScore: preliminary.score,
      scoreBreakdown: preliminary.breakdown,
    };
    return {
      ...updated,
      reasons: buildReasons(updated),
    };
  });

  candidates = candidates
    .sort(
      (a, b) =>
        b.preliminaryAiScore - a.preliminaryAiScore ||
        a.competition.riskScore - b.competition.riskScore ||
        b.independentPublisherCount - a.independentPublisherCount,
    )
    .slice(0, clamp(input.maxResults, 5, 30))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  if (recentArticles.length === 0) {
    warnings.push("선택한 신규 신호 탐지 범위에 포함되는 뉴스가 없습니다. 탐지 범위를 넓혀 다시 수집해 보세요.");
  }
  if (failedSeedCount > 0) {
    warnings.push("일부 시드 검색이 실패해 해당 시드는 점수 계산에서 제외했습니다.");
  }
  if (
    candidates.length > 0 &&
    candidates.every((item) => item.autocomplete.status !== "ok")
  ) {
    warnings.push(
      "NAVER 자동완성 보조 신호를 확보하지 못했습니다. 자동완성은 비공식 보조 수집이므로 뉴스·Trend·블로그 검증은 그대로 유지됩니다.",
    );
  }

  const categoryLabel =
    input.categorySelection === "all"
      ? "전체 4개 카테고리"
      : getBlogCategory(input.categorySelection).label;

  return {
    ok: true,
    collectedAt: new Date().toISOString(),
    opportunities: candidates,
    summary: {
      categorySelection: input.categorySelection,
      categoryLabel,
      requestedSeedCount: seeds.length,
      successfulSeedCount,
      failedSeedCount,
      rawArticleCount: rawRows.length,
      recentArticleCount: recentArticles.length,
      clusterCount: clusters.length,
      trendValidatedCount: candidates.filter((item) => item.trend.status === "ok").length,
      competitionValidatedCount: candidates.filter((item) => item.competition.status === "ok").length,
      autocompleteValidatedCount: candidates.filter((item) => item.autocomplete.status === "ok").length,
      apiMode: getNaverApiMode(),
      windowHours,
      analysisWindowHours,
    },
    warnings,
  };
}

export function parseCategorySelection(value: unknown): CategorySelection {
  if (value === "all") return "all";
  if (typeof value === "string" && BLOG_CATEGORY_IDS.has(value as BlogCategoryId)) {
    return value as BlogCategoryId;
  }
  return "all";
}
