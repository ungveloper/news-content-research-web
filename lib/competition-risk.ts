type AnyRecord = Record<string, unknown>;

const DIRECT_RISK_KEYS = [
  "competitionRiskScore",
  "competition_risk_score",
  "estimatedCompetitionRiskScore",
  "estimated_competition_risk_score",
  "competitionScore",
  "competition_score",
  "riskScore",
  "risk_score",
];

const HEADROOM_KEYS = [
  "competitionHeadroom",
  "competition_headroom",
  "competitionHeadroomScore",
  "competition_headroom_score",
];

const SEARCH_OPPORTUNITY_KEYS = [
  "searchOpportunityScore",
  "search_opportunity_score",
  "opportunityScore",
  "opportunity_score",
];

const RISK_LABEL_KEYS = [
  "competitionRisk",
  "competition_risk",
  "competitionRiskLabel",
  "competition_risk_label",
];

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function findByKeys(value: unknown, keys: string[], depth = 0): unknown {
  if (!isRecord(value) || depth > 3) return undefined;

  for (const key of keys) {
    if (key in value) return value[key];
  }

  for (const child of Object.values(value)) {
    if (!isRecord(child)) continue;
    const nested = findByKeys(child, keys, depth + 1);
    if (nested !== undefined) return nested;
  }

  return undefined;
}

function labelFor(score: number): "낮음" | "보통" | "높음" {
  if (score <= 33) return "낮음";
  if (score <= 66) return "보통";
  return "높음";
}

function midpointForLabel(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/\s+/g, "");

  if (normalized.includes("매우낮") || normalized.includes("verylow")) return 15;
  if (normalized.includes("낮") || normalized.includes("low")) return 25;
  if (
    normalized.includes("보통") ||
    normalized.includes("중간") ||
    normalized.includes("medium") ||
    normalized.includes("moderate")
  ) {
    return 50;
  }
  if (normalized.includes("매우높") || normalized.includes("veryhigh")) return 90;
  if (normalized.includes("높") || normalized.includes("high")) return 75;
  return null;
}

export function estimateCompetitionRisk(record: unknown): {
  score: number;
  label: "낮음" | "보통" | "높음";
  source: string;
} {
  const direct = finiteNumber(findByKeys(record, DIRECT_RISK_KEYS));
  if (direct !== null) {
    const score = clampScore(direct);
    return { score, label: labelFor(score), source: "직접 경쟁 위험 점수" };
  }

  const headroom = finiteNumber(findByKeys(record, HEADROOM_KEYS));
  if (headroom !== null) {
    const score = clampScore(100 - headroom);
    return { score, label: labelFor(score), source: "경쟁 여유 점수 역산" };
  }

  const labelMidpoint = midpointForLabel(findByKeys(record, RISK_LABEL_KEYS));
  if (labelMidpoint !== null) {
    const score = clampScore(labelMidpoint);
    return { score, label: labelFor(score), source: "기존 경쟁 위험 등급 환산" };
  }

  const opportunity = finiteNumber(findByKeys(record, SEARCH_OPPORTUNITY_KEYS));
  if (opportunity !== null) {
    const score = clampScore(100 - opportunity);
    return { score, label: labelFor(score), source: "검색 기회 점수 보조 역산" };
  }

  return { score: 50, label: "보통", source: "경쟁 신호 미확보 중립 추정값" };
}

export function formatCompetitionRisk(record: unknown): string {
  const risk = estimateCompetitionRisk(record);
  return `${risk.label} (${risk.score}/100)`;
}
