import type { BlogCategoryId } from "@/lib/categories";

export type CategorySelection = "all" | BlogCategoryId;

export type CompetitionRiskLevel = "낮음" | "보통" | "높음" | "매우 높음";
export type SearchOpportunityLevel = "낮음" | "보통" | "높음" | "매우 높음";
export type SearchOpportunityGate = "통과" | "주의" | "제외";

export type ManualAutocompleteCapturePlan = {
  opportunityId: string;
  rank: number;
  title: string;
  query: string;
};

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

export type AutocompleteSignal = {
  status: "ok" | "no-data" | "error";
  query: string;
  suggestions: string[];
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


export type SearchOpportunityBreakdown = {
  demandPotential: number;
  competitionHeadroom: number;
  intentSpecificity: number;
  contentGapPotential: number;
  timingWindow: number;
  evidenceStrength: number;
};

export type SearchOpportunityAssessment = {
  score: number;
  level: SearchOpportunityLevel;
  gate: SearchOpportunityGate;
  breakdown: SearchOpportunityBreakdown;
  reasons: string[];
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
  researchGroupId: string;
  researchGroupLabel: string;
  isTemporaryCategory: boolean;
  id: string;
  rank: number;
  categoryId: BlogCategoryId;
  categoryLabel: string;
  topic: string;
  representativeTitle: string;
  searchKeyword: string;
  longtailHint: string;
  secondQuestion: string;
  autocomplete: AutocompleteSignal;
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
  searchOpportunity: SearchOpportunityAssessment;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
  articles: NewsArticleSummary[];
};

export type NewsResearchGroup = {
  id: string;
  label: string;
  description: string;
  temporary: boolean;
  opportunityIds: string[];
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
  autocompleteValidatedCount: number;
  searchOpportunityEvaluatedCount: number;
  searchOpportunityExcludedCount: number;
  apiMode: "hub" | "legacy";
  windowHours: number;
  analysisWindowHours: number;
  temporaryGroupCount: number;
};

export type NewsResearchResponse = {
  ok: true;
  collectedAt: string;
  opportunities: NewsOpportunity[];
  groups: NewsResearchGroup[];
  summary: NewsResearchSummary;
  warnings: string[];
};

export type NewsResearchErrorResponse = {
  ok: false;
  message: string;
};
