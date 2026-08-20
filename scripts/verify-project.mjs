import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "app/page.tsx",
  "app/api/news/opportunities/route.ts",
  "components/news-research-workbench.tsx",
  "lib/categories.ts",
  "lib/news/naver-api.ts",
  "lib/news/news-research.ts",
  "lib/news/scoring.ts",
  "lib/research-package.ts",
  "lib/types.ts",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error(`필수 파일이 없습니다:\n${missing.join("\n")}`);
  process.exit(1);
}

const categories = fs.readFileSync(path.join(root, "lib/categories.ts"), "utf8");
for (const label of ["IT·AI", "경제·재테크·투자", "생활·실용정보", "취업·자격증·직무"]) {
  if (!categories.includes(label)) {
    console.error(`카테고리 정의 누락: ${label}`);
    process.exit(1);
  }
}

for (const marker of ["TEMPORARY_RESEARCH_GROUPS", "건강·의료", "교육·입시", "자동차·모빌리티", "여행·관광"]) {
  if (!categories.includes(marker)) {
    console.error(`확장 추천 탐색 정의 누락: ${marker}`);
    process.exit(1);
  }
}

const prompt = fs.readFileSync(path.join(root, "lib/research-package.ts"), "utf8");
for (const heading of ["# 1. 게시용 본문", "# 2. 게시 전 확인 자료", "# 3. 대표 이미지 생성 프롬프트", "# 4. Rank Math SEO 패키지"]) {
  if (!prompt.includes(heading)) {
    console.error(`최종 출력 형식 누락: ${heading}`);
    process.exit(1);
  }
}

for (const marker of [
  "NAVER 자동완성",
  "예비 AI 추천 점수",
  "예상 경쟁 위험",
  "대표 핵심 롱테일",
  "검색 기회 점수",
  "사전 검색 기회 게이트 해석",
  "Google SEO 검증",
  "Naver SEO 검증",
  "AdSense 콘텐츠 가치",
  "내부링크 계획",
  "독자 가치 자산을 최소 2개",
  "출판 SEO 점검",
  "자동완성 캡처 정밀검증",
  "자동완성 캡처 권장도",
  "추가 정밀검증 필요성 낮음/보통으로 생략",
  "처음으로 관련 자동완성이 나타나는 단계",
  "제안어 미확보 (검색 수요 없음 의미 아님)",
  "# 복사 범위",
  "신규 카테고리 제안",
]) {
  if (!prompt.includes(marker)) {
    console.error(`심층 검증 프롬프트 누락: ${marker}`);
    process.exit(1);
  }
}

const scoreIndex = prompt.indexOf("- **예비 AI 추천 점수:**");
const riskIndex = prompt.indexOf("- **예상 경쟁 위험:**");
const longtailIndex = prompt.indexOf("- **대표 핵심 롱테일:**");
const opportunityIndex = prompt.indexOf("- **검색 기회 점수:**");
const categoryIndex = prompt.indexOf("- **카테고리:**");
if (!(scoreIndex < riskIndex && riskIndex < longtailIndex && longtailIndex < opportunityIndex && opportunityIndex < categoryIndex)) {
  console.error("최종 추천 카드의 핵심 정보 순서가 올바르지 않습니다.");
  process.exit(1);
}


const workbench = fs.readFileSync(
  path.join(root, "components/news-research-workbench.tsx"),
  "utf8",
);
for (const marker of [
  "DEFAULT_PROMPT_VERSION",
  "all-category-grouped-prompts-v7",
  "최근 10분 (기본 · 초고속 탐지)",
  "아래 카테고리별 버튼을 눌러 필요한 ChatGPT 프롬프트를 직접 복사해 주세요.",
  "prompt-group-grid",
  "기본 4개 카테고리는 항상 모두 조회",
]) {
  if (!workbench.includes(marker)) {
    console.error(`10분 탐지·수동 복사 로직 누락: ${marker}`);
    process.exit(1);
  }
}


if (workbench.includes("copyResearchPackage(result, true)")) {
  console.error("수집 완료 후 자동 클립보드 복사 호출이 남아 있습니다.");
  process.exit(1);
}

const newsResearch = fs.readFileSync(path.join(root, "lib/news/news-research.ts"), "utf8");
for (const marker of [
  "clamp(input.windowHours, 1 / 6, 48)",
  "Math.max(windowHours, 3)",
  "detectionCutoff",
  "analysisCutoff",
  "TEMPORARY_RESEARCH_GROUPS",
  "temporaryGroups",
  "coreGroups",
]) {
  if (!newsResearch.includes(marker)) {
    console.error(`10분 탐지·3시간 확산 분석 로직 누락: ${marker}`);
    process.exit(1);
  }
}

const scoring = fs.readFileSync(path.join(root, "lib/news/scoring.ts"), "utf8");
for (const marker of [
  "calculateSearchOpportunityAssessment",
  "competitionHeadroom",
  "contentGapPotential",
  "gate",
]) {
  if (!scoring.includes(marker)) {
    console.error(`검색 기회 점수 로직 누락: ${marker}`);
    process.exit(1);
  }
}

if (!newsResearch.includes('item.searchOpportunity.gate !== "제외"')) {
  console.error("검색 기회 게이트 제외 로직이 누락되었습니다.");
  process.exit(1);
}

const naverApi = fs.readFileSync(path.join(root, "lib/news/naver-api.ts"), "utf8");
if (!naverApi.includes("ac.search.naver.com/nx/ac")) {
  console.error("NAVER 자동완성 수집 로직이 누락되었습니다.");
  process.exit(1);
}

console.log("news-content-research-web 구조 검증 완료");
