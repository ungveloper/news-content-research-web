import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const floor = "4.6.6";

function tuple(version) {
  return String(version).split("-")[0].split(".").slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

function atLeast(version, minimum) {
  const a = tuple(version);
  const b = tuple(minimum);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

if (pkg.overrides?.zod !== floor) {
  console.error(`zod override 불일치: ${pkg.overrides?.zod ?? "(missing)"} != ${floor}`);
  process.exit(1);
}

const copies = Object.entries(lock.packages ?? {})
  .filter(([key]) => key.endsWith("node_modules/zod"))
  .map(([key, meta]) => ({ key, version: meta.version, dev: meta.dev === true }));

if (copies.length === 0) {
  console.error("package-lock.json에서 zod를 찾지 못했습니다.");
  process.exit(1);
}

for (const item of copies) {
  if (!atLeast(item.version, floor)) {
    console.error(`${item.key}: zod ${item.version} < ${floor}`);
    process.exit(1);
  }
}

console.log("Zod security floor 검증 완료");
for (const item of copies) {
  console.log(`- ${item.key}: ${item.version}${item.dev ? " (dev-only)" : ""}`);
}
