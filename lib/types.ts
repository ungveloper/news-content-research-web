import type { BlogCategoryId } from "@/lib/categories";

export type CategorySelection = "all" | BlogCategoryId;

export type CompetitionRiskLevel = "낮음" | "보통" | "높음" | "매우 높음";

export type NewsArticleSummary = {
  title: string;
  description: string;
  url: string;
  originalUrl: string;
  publishedAt: string;
  publisher: string;
  matchedSeed: string;
};

export type SearchTrendSignal = {
  status: "ok" | "no-data" | "error";
  latestRatio: number | null;
  recentAverage: number | null;
  baselineAverage: number | null;
  momentumPercent: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type CompetitionSignal = {
  status: "ok" | "error" | "not-checked";
  query: string;
  blogResultTotal: number | null;
  similarTopResultCount: number | null;
  titleSimilarityAverage: number | null;
  riskScore: number;
  riskLevel: CompetitionRiskLevel;
};

export type ScoreBreakdown = {
  newsVelocity: number;
  searchInterest: number;
  categoryFit: number;
  secondQuestionClarity: number;
  verificationEase: number;
  contentGap: number;
  timing: number;
};

export type NewsOpportunity = {
  id: string;
  rank: number;
  categoryId: BlogCategoryId;
  categoryLabel: string;
  topic: string;
  representativeTitle: string;
  searchKeyword: string;
  longtailHint: string;
  secondQuestion: string;
  matchedSeeds: string[];
  articleCount: number;
  independentPublisherCount: number;
  last1HourCount: number;
  last3HourCount: number;
  last6HourCount: number;
  newestPublishedAt: string;
  oldestPublishedAt: string;
  ageMinutes: number;
  newsVelocityLabel: "급상승" | "상승" | "관찰";
  trend: SearchTrendSignal;
  competition: CompetitionSignal;
  preliminaryAiScore: number;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
  articles: NewsArticleSummary[];
};

export type NewsResearchSummary = {
  categorySelection: CategorySelection;
  categoryLabel: string;
  requestedSeedCount: number;
  successfulSeedCount: number;
  failedSeedCount: number;
  rawArticleCount: number;
  recentArticleCount: number;
  clusterCount: number;
  trendValidatedCount: number;
  competitionValidatedCount: number;
  apiMode: "hub" | "legacy";
  windowHours: number;
};

export type NewsResearchResponse = {
  ok: true;
  collectedAt: string;
  opportunities: NewsOpportunity[];
  summary: NewsResearchSummary;
  warnings: string[];
};

export type NewsResearchErrorResponse = {
  ok: false;
  message: string;
};
