import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "lib/research-package.ts");
if (!fs.existsSync(target)) {
  console.error("출처 번호 검증 실패: lib/research-package.ts 없음");
  process.exit(1);
}

const source = fs.readFileSync(target, "utf8");
const text = source.replaceAll("\\`", "`").replaceAll("\\${", "${");

for (const marker of [
  "# 출처 소제목별 번호 초기화 규칙 (2026-10-14)",
  "각 소제목 아래 첫 번째 출처는 항상 `1.`부터 시작한다",
  "`추가 참고자료`의 첫 항목은 `6.`이 아니라 반드시 `1.`이다",
  "새 소제목이 시작되면 번호를 다시 1부터 초기화한다",
  "`<ol start=\"6\">`",
  "출처 제목 자체가 링크가 되는 기존 형식은 그대로 유지한다",
]) {
  if (!text.includes(marker)) {
    console.error(`출처 번호 계약 누락: ${marker}`);
    process.exit(1);
  }
}

console.log("출처 소제목별 ordered list 1번 재시작 계약 검증 완료");
