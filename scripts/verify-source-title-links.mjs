import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "lib/research-package.ts");

if (!fs.existsSync(target)) {
  console.error("출처 제목 링크 형식 검증 실패: lib/research-package.ts가 없습니다.");
  process.exit(1);
}

const text = fs.readFileSync(target, "utf8");
const required = [
  "# 출처 링크 가독성 규칙 (2026-10-08)",
  "클릭 가능한 대상은 URL 문자열이 아니라 문서 제목 자체",
  "한 출처 항목에는 대표 Markdown 링크를 원칙적으로 1개만",
  "URL을 링크 뒤에 평문 또는 같은 URL의 링크로 다시 붙이지 않는다",
  "여러 링크 조각을 한 출처 항목에 이어 붙이지 않는다",
  "표시 제목에 대괄호가 들어 있으면",
  "출처 항목 최종 자가검사"
];

for (const marker of required) {
  if (!text.includes(marker)) {
    console.error(`출처 제목 링크 형식 규칙 누락: ${marker}`);
    process.exit(1);
  }
}

for (const marker of [
  "1. **기관명** — [문서 제목](https://example.com/original), YYYY-MM-DD.",
  "링크 표시문에 https:// 또는 www.를 사용하지 않는다",
  "같은 출처의 경로 조각",
  "각 출처 줄의 Markdown 링크 개수가 원칙적으로 1개인지",
]) {
  if (!text.includes(marker)) {
    console.error(`출처 링크 최종 형식 계약 누락: ${marker}`);
    process.exit(1);
  }
}

console.log("출처 제목 직접 링크 · 중복 URL 금지 · 한 줄 출처 형식 검증 완료");
