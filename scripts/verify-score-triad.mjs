import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components/news-research-workbench.tsx");
if (!fs.existsSync(target)) {
  console.error("추천 카드 UI 파일이 없습니다.");
  process.exit(1);
}

const text = fs.readFileSync(target, "utf8");
const anchor = text.indexOf("feed.opportunities.map((item) =>");
if (anchor < 0) {
  console.error("실제 opportunity 카드 렌더링 영역을 찾지 못했습니다.");
  process.exit(1);
}

const after = text.slice(anchor);
const riskMatch = after.match(/<span>\s*예상 경쟁 위험\s*<\/span>/s);
if (!riskMatch || riskMatch.index === undefined) {
  console.error("실제 opportunity 카드의 '예상 경쟁 위험' 제목을 찾지 못했습니다.");
  process.exit(1);
}

const riskPos = anchor + riskMatch.index;
const window = text.slice(riskPos, riskPos + 1600);

if (!/<strong>\s*\{item\.competition\.riskScore\}\s*\/\s*100\s*<\/strong>/s.test(window)) {
  console.error("예상 경쟁 위험의 큰 값이 riskScore/100이 아닙니다.");
  process.exit(1);
}

const small = window.match(/<small>(.*?)<\/small>/s);
if (!small || !small[1].includes("item.competition.riskLevel")) {
  console.error("예상 경쟁 위험의 보조값에 riskLevel이 없습니다.");
  process.exit(1);
}

if (text.includes('{" · 예상 경쟁 위험: "}{formatCompetitionRisk(group)}')) {
  console.error("이전 잘못된 group 인라인 경쟁 위험 표시가 남아 있습니다.");
  process.exit(1);
}

if (!text.includes("예상 경쟁 위험 카드 표시 계약: 큰 값 riskScore/100 → 보조 riskLevel")) {
  console.error("예상 경쟁 위험 표시 계약 마커가 없습니다.");
  process.exit(1);
}

console.log("추천 카드 예상 경쟁 위험: 큰 값 N/100 → 아래 등급 표시 계약 검증 완료");
