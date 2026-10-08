import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "lib/research-package.ts");
if (!fs.existsSync(target)) {
  console.error("출력 품질 검증 실패: lib/research-package.ts 없음");
  process.exit(1);
}

const source = fs.readFileSync(target, "utf8");
const text = source.replaceAll("\\`", "`").replaceAll("\\${", "${");

for (const marker of [
  "# 출력 위생·카테고리·태그·제목 우선 규칙 (2026-10-08 v3)",
  "경제·재테크·투자",
  "생활·실용정보",
  "취업·자격증·직무",
  "IT·AI",
  "`카테고리명` 다음 줄에는 카테고리 값 하나만 출력한다",
  "글 태그는 3~5개만 출력한다",
  "4개를 기본값으로 사용한다",
  "5개를 절대 초과하지 않는다",
  "기본 구분자는 `｜` 또는 `|`가 아니라 `: `를 사용한다",
  "카테고리본문 추출",
  "자동 매칭되는 기존 카테고리가 없습니다",
]) {
  if (!text.includes(marker)) {
    console.error(`출력 품질 계약 누락: ${marker}`);
    process.exit(1);
  }
}

console.log("카테고리 단일값 · 태그 3~5개 · 제목 콜론 · 본문 UI 문구 금지 계약 검증 완료");
