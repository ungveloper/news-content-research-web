import type { BlogCategory } from "@/lib/categories";
import type {
  CompetitionRiskLevel,
  CompetitionSignal,
  ScoreBreakdown,
  SearchOpportunityAssessment,
  SearchOpportunityLevel,
  SearchTrendSignal,
} from "@/lib/types";

export const STOP_WORDS = new Set([
  "단독",
  "속보",
  "종합",
  "영상",
  "포토",
  "뉴스",
  "오늘",
  "내일",
  "관련",
  "기자",
  "논란",
  "대한",
  "위한",
  "통해",
  "에서",
  "으로",
  "까지",
  "한다",
  "했다",
  "된다",
  "밝혀",
  "밝혔다",
  "공개",
  "발표",
  "정부",
  "국내",
  "한국",
]);

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return stripHtml(value)
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );
}

export function tokenSimilarity(first: string, second: string): number {
  const firstSet = new Set(tokenize(first));
  const secondSet = new Set(tokenize(second));
  if (firstSet.size === 0 || secondSet.size === 0) return 0;

  let intersection = 0;
  for (const token of firstSet) {
    if (secondSet.has(token)) intersection += 1;
  }

  const union = firstSet.size + secondSet.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

export function getRiskLevel(score: number): CompetitionRiskLevel {
  if (score >= 85) return "매우 높음";
  if (score >= 65) return "높음";
  if (score >= 35) return "보통";
  return "낮음";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildCompetitionSignal(input: {
  query: string;
  blogResultTotal: number;
  blogTitles: string[];
  articleCount: number;
  publisherCount: number;
  topic: string;
}): CompetitionSignal {
  const similarities = input.blogTitles.map((title) =>
    tokenSimilarity(title, input.query),
  );
  const similarTopResultCount = similarities.filter((value) => value >= 0.34).length;
  const titleSimilarityAverage =
    similarities.length > 0
      ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
      : 0;

  const resultVolumeRisk = clamp(Math.log10(input.blogResultTotal + 1) * 7, 0, 30);
  const titleOverlapRisk = clamp(titleSimilarityAverage * 42, 0, 25);
  const freshNewsRisk = clamp(input.articleCount * 1.8 + input.publisherCount * 1.25, 0, 25);
  const broadTopicRisk = tokenize(input.topic).length <= 1 ? 15 : tokenize(input.topic).length === 2 ? 7 : 2;
  const riskScore = Math.round(
    clamp(resultVolumeRisk + titleOverlapRisk + freshNewsRisk + broadTopicRisk, 0, 100),
  );

  return {
    status: "ok",
    query: input.query,
    blogResultTotal: input.blogResultTotal,
    similarTopResultCount,
    titleSimilarityAverage: Number(titleSimilarityAverage.toFixed(3)),
    riskScore,
    riskLevel: getRiskLevel(riskScore),
  };
}

export function emptyCompetitionSignal(query: string): CompetitionSignal {
  return {
    status: "not-checked",
    query,
    blogResultTotal: null,
    similarTopResultCount: null,
    titleSimilarityAverage: null,
    riskScore: 50,
    riskLevel: "보통",
  };
}

export function getSearchInterestScore(trend: SearchTrendSignal): number {
  if (trend.status !== "ok" || trend.momentumPercent === null) return 5;
  if (trend.momentumPercent >= 150) return 20;
  if (trend.momentumPercent >= 80) return 18;
  if (trend.momentumPercent >= 40) return 15;
  if (trend.momentumPercent >= 15) return 12;
  if (trend.momentumPercent > 0) return 9;
  return 4;
}

export function getClarityScore(title: string, category: BlogCategory): number {
  const normalized = stripHtml(title);
  const hits = category.intentKeywords.filter((keyword) => normalized.includes(keyword)).length;
  const universalIntent = [
    "변경",
    "시행",
    "확정",
    "신청",
    "대상",
    "조건",
    "가격",
    "일정",
    "출시",
    "공개",
    "인상",
    "인하",
    "모집",
    "접수",
  ].filter((keyword) => normalized.includes(keyword)).length;

  return clamp(8 + hits * 3 + universalIntent * 2, 8, 20);
}


export function getSearchOpportunityLevel(score: number): SearchOpportunityLevel {
  if (score >= 82) return "매우 높음";
  if (score >= 70) return "높음";
  if (score >= 55) return "보통";
  return "낮음";
}

export function calculateSearchOpportunityAssessment(input: {
  last1HourCount: number;
  last3HourCount: number;
  publisherCount: number;
  ageMinutes: number;
  title: string;
  longtailHint: string;
  category: BlogCategory;
  trend: SearchTrendSignal;
  competition: CompetitionSignal;
  autocompleteCount: number;
}): SearchOpportunityAssessment {
  const trendDemand = Math.round(clamp(getSearchInterestScore(input.trend) * 0.75, 0, 15));
  const newsDemand = Math.round(
    clamp(
      input.last1HourCount * 1.35 +
        input.last3HourCount * 0.28 +
        input.publisherCount * 0.5,
      0,
      8,
    ),
  );
  const autocompleteDemand = input.autocompleteCount > 0 ? 2 : 0;
  let demandPotential = Math.round(
    clamp(trendDemand + newsDemand + autocompleteDemand, 0, 25),
  );

  const hasNoIndependentDemandSignal =
    input.trend.status !== "ok" && input.autocompleteCount === 0;
  if (hasNoIndependentDemandSignal) {
    demandPotential = Math.max(4, demandPotential - 2);
  }

  const longtailTokenCount = tokenize(input.longtailHint).length;
  const longtailShapeAdjustment =
    longtailTokenCount >= 3 && longtailTokenCount <= 8 ? 0 : -2;
  const intentSpecificity = Math.round(
    clamp(
      getClarityScore(input.title, input.category) + longtailShapeAdjustment,
      5,
      20,
    ),
  );

  const competitionHeadroom =
    input.competition.status === "ok"
      ? Math.round(clamp((100 - input.competition.riskScore) * 0.2, 2, 20))
      : 8;

  const similarTopResultCount = input.competition.similarTopResultCount ?? 5;
  const similarityAverage = input.competition.titleSimilarityAverage ?? 0.35;
  let contentGapPotential =
    similarTopResultCount === 0
      ? 15
      : similarTopResultCount <= 1
        ? 13
        : similarTopResultCount <= 2
          ? 11
          : similarTopResultCount <= 4
            ? 8
            : similarTopResultCount <= 6
              ? 5
              : 3;
  if (similarityAverage >= 0.45) contentGapPotential -= 2;
  if (
    input.competition.blogResultTotal === 0 &&
    hasNoIndependentDemandSignal
  ) {
    contentGapPotential -= 4;
  }
  contentGapPotential = Math.round(clamp(contentGapPotential, 2, 15));

  const timingWindow =
    input.ageMinutes <= 30
      ? 10
      : input.ageMinutes <= 60
        ? 9
        : input.ageMinutes <= 120
          ? 8
          : input.ageMinutes <= 360
            ? 6
            : input.ageMinutes <= 720
              ? 4
              : 2;

  const publisherEvidence =
    input.publisherCount >= 8
      ? 6
      : input.publisherCount >= 5
        ? 5
        : input.publisherCount >= 3
          ? 4
          : input.publisherCount >= 2
            ? 3
            : 1;
  const evidenceStrength = Math.round(
    clamp(
      publisherEvidence +
        (input.trend.status === "ok" ? 2 : 0) +
        (input.autocompleteCount > 0 ? 2 : 0),
      1,
      10,
    ),
  );

  const breakdown = {
    demandPotential,
    competitionHeadroom,
    intentSpecificity,
    contentGapPotential,
    timingWindow,
    evidenceStrength,
  };
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const level = getSearchOpportunityLevel(score);
  const gate =
    score < 55 ||
    (input.competition.riskScore >= 85 && score < 82) ||
    (input.competition.riskScore >= 65 && score < 65)
      ? "제외"
      : input.competition.riskScore >= 65 || score < 70
        ? "주의"
        : "통과";

  const reasons: string[] = [];
  if (demandPotential >= 18) reasons.push("검색·뉴스 수요 신호가 강합니다.");
  if (intentSpecificity >= 16) reasons.push("후속 검색 의도가 구체적입니다.");
  if (competitionHeadroom >= 14) reasons.push("사전 경쟁 신호 대비 진입 여지가 있습니다.");
  if (contentGapPotential >= 11) reasons.push("유사 제목이 적어 콘텐츠 공백 가능성이 있습니다.");
  if (hasNoIndependentDemandSignal) reasons.push("Trend·자동완성 신호가 없어 수요 확신도는 보수적으로 낮췄습니다.");
  if (input.competition.riskScore >= 65) reasons.push("경쟁 위험이 높아 실제 Google·Naver SERP 재검증이 필수입니다.");

  return {
    score,
    level,
    gate,
    breakdown,
    reasons: reasons.slice(0, 4),
  };
}

export function calculatePreliminaryScore(input: {
  last1HourCount: number;
  last3HourCount: number;
  last6HourCount: number;
  articleCount: number;
  publisherCount: number;
  ageMinutes: number;
  categoryShare: number;
  title: string;
  category: BlogCategory;
  trend: SearchTrendSignal;
  competition: CompetitionSignal;
}): { score: number; breakdown: ScoreBreakdown } {
  const newsVelocity = Math.round(
    clamp(
      input.last1HourCount * 5 +
        input.last3HourCount * 2.1 +
        input.last6HourCount * 0.8 +
        input.publisherCount * 1.1,
      0,
      20,
    ),
  );
  const searchInterest = getSearchInterestScore(input.trend);
  const categoryFit = Math.round(clamp(input.categoryShare * 15, 5, 15));
  const secondQuestionClarity = Math.round(getClarityScore(input.title, input.category));
  const verificationEase = Math.round(
    clamp(input.publisherCount >= 4 ? 10 : input.publisherCount >= 2 ? 8 : 5, 0, 10),
  );
  const contentGap = Math.round(
    clamp(10 - Math.max(0, input.competition.riskScore - 25) / 8, 2, 10),
  );
  const timing = input.ageMinutes <= 120 ? 5 : input.ageMinutes <= 360 ? 4 : input.ageMinutes <= 720 ? 3 : 2;
  const breakdown: ScoreBreakdown = {
    newsVelocity,
    searchInterest,
    categoryFit,
    secondQuestionClarity,
    verificationEase,
    contentGap,
    timing,
  };

  return {
    score: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    breakdown,
  };
}
