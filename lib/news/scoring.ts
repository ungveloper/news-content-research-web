import type { BlogCategory } from "@/lib/categories";
import type {
  CompetitionRiskLevel,
  CompetitionSignal,
  ScoreBreakdown,
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
