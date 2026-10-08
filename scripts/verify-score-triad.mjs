import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const helperPath = path.join(root, "lib/competition-risk.ts");
const workbenchPath = path.join(root, "components/news-research-workbench.tsx");

if (!fs.existsSync(helperPath)) {
  console.error("경쟁 위험 점수 helper가 없습니다.");
  process.exit(1);
}
if (!fs.existsSync(workbenchPath)) {
  console.error("추천 카드 UI 파일이 없습니다.");
  process.exit(1);
}

const helper = fs.readFileSync(helperPath, "utf8");
const workbench = fs.readFileSync(workbenchPath, "utf8");

for (const marker of [
  "competitionRiskScore",
  "competitionHeadroom",
  "searchOpportunityScore",
  "100 - opportunity",
  'return { score: 50, label: "보통"',
  "formatCompetitionRisk",
]) {
  if (!helper.includes(marker)) {
    console.error(`경쟁 위험 계산 계약 누락: ${marker}`);
    process.exit(1);
  }
}

for (const marker of [
  "예비 AI 추천 점수",
  "검색 기회 점수",
  "예상 경쟁 위험:",
  "formatCompetitionRisk(group)",
]) {
  if (!workbench.includes(marker)) {
    console.error(`추천 점수 3종 UI 계약 누락: ${marker}`);
    process.exit(1);
  }
}

console.log("추천 카드 점수 3종 인라인 표시 계약 검증 완료");
