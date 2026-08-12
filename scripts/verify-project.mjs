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

console.log("news-content-research-web 구조 검증 완료");
