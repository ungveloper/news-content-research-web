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
  "Google SEO 검증",
  "Naver SEO 검증",
  "AdSense 콘텐츠 가치",
  "내부링크 계획",
  "독자 가치 자산을 최소 2개",
  "출판 SEO 점검",
  "사용자 추가 자동완성 캡처",
  "캡처 미첨부",
]) {
  if (!prompt.includes(marker)) {
    console.error(`심층 검증 프롬프트 누락: ${marker}`);
    process.exit(1);
  }
}

const scoreIndex = prompt.indexOf("- **예비 AI 추천 점수:**");
const riskIndex = prompt.indexOf("- **예상 경쟁 위험:**");
const longtailIndex = prompt.indexOf("- **대표 핵심 롱테일:**");
const categoryIndex = prompt.indexOf("- **카테고리:**");
if (!(scoreIndex < riskIndex && riskIndex < longtailIndex && longtailIndex < categoryIndex)) {
  console.error("최종 추천 카드의 핵심 정보 순서가 올바르지 않습니다.");
  process.exit(1);
}


const workbench = fs.readFileSync(
  path.join(root, "components/news-research-workbench.tsx"),
  "utf8",
);
for (const marker of [
  "DEFAULT_PROMPT_VERSION",
  "google-naver-adsense-autocomplete-capture-v3",
  "자동완성 캡처 추가 검증",
  "autocompleteCapturePlans",
]) {
  if (!workbench.includes(marker)) {
    console.error(`프롬프트 버전 전환 로직 누락: ${marker}`);
    process.exit(1);
  }
}

const naverApi = fs.readFileSync(path.join(root, "lib/news/naver-api.ts"), "utf8");
if (!naverApi.includes("ac.search.naver.com/nx/ac")) {
  console.error("NAVER 자동완성 수집 로직이 누락되었습니다.");
  process.exit(1);
}

console.log("news-content-research-web 구조 검증 완료");
