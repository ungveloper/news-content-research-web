import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "lib/research-package.ts");
if (!fs.existsSync(target)) {
  console.error("발행 기본값 검증 실패: lib/research-package.ts 없음");
  process.exit(1);
}
const sourceText = fs.readFileSync(target, "utf8");
const text = sourceText
  .replaceAll("\\`", "`")
  .replaceAll("\\${", "${");
const required = [
  "# 뉴스 기반 발행 기본값 우선 규칙 (2026-10-08)",
  "SEO 신호가 불완전하다는 이유로 완성 글 생성을 중단하지 않는다",
  "Google 실제 검색결과 페이지를 직접 열람하지 못함",
  "보류 전에 반드시 수행할 복구 절차",
  "`# 검증 보류`를 허용하는 하드 게이트",
  "10개 후보 전체가 0건 발행되는 결과",
  "SEO 접근 제한이나 검색 신호 부족 때문에 10건 전부를 보류하는 것은 논리 오류",
  "기준을 완화하는 대상은 `SEO 신호의 증명 수준`이지 글의 정확성·독창성·유용성이 아니다",
  "`SEO 신호 상태: 미확인`이어도 하드 게이트가 아니면 발행 상태는 `조건부 발행` 이상"
];

for (const marker of required) {
  if (!text.includes(marker)) {
    console.error(`발행 기본값 규칙 누락: ${marker}`);
    process.exit(1);
  }
}

if (!sourceText.includes("\\`# 검증 보류\\`") && !text.includes("`# 검증 보류`")) {
  console.error("발행 기본값 검증 실패: 템플릿 리터럴 내 검증 보류 규칙을 확인하지 못했습니다.");
  process.exit(1);
}

console.log("뉴스 기반 발행 기본값 · SEO soft gate · hard hold 계약 검증 완료");

