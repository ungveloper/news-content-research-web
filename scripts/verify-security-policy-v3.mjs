import fs from "node:fs";

const fail = (message) => {
  console.error(`보안 dependency/policy 검증 실패: ${message}`);
  process.exit(1);
};
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const policy = JSON.parse(fs.readFileSync(".security/npm-audit-exceptions.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));

function tuple(version) {
  return String(version).split("-")[0].split(".").slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}
function atLeast(version, floor) {
  const a = tuple(version);
  const b = tuple(floor);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

const next = lock.packages?.["node_modules/next"]?.version;
const eslintNext = lock.packages?.["node_modules/eslint-config-next"]?.version;
const sharp = lock.packages?.["node_modules/sharp"]?.version;
if (manifest.dependencies?.next !== "16.4.6" || next !== "16.4.6") fail(`next=${next ?? "(missing)"}`);
if (manifest.devDependencies?.["eslint-config-next"] !== "16.4.6" || eslintNext !== "16.4.6") {
  fail(`eslint-config-next=${eslintNext ?? "(missing)"}`);
}
if (!atLeast(sharp, "0.35.5")) fail(`sharp=${sharp ?? "(missing)"} < 0.35.5`);

const sourceMapCopies = Object.entries(lock.packages ?? {})
  .filter(([key]) => key.endsWith("node_modules/source-map-js"))
  .map(([key, meta]) => ({ key, version: meta.version }));
if (sourceMapCopies.length === 0) fail("source-map-js 설치 항목 없음");
for (const item of sourceMapCopies) {
  if (!atLeast(item.version, "1.2.2")) fail(`${item.key}=${item.version} < 1.2.2`);
}

const braceExpansionCopies = Object.entries(lock.packages ?? {})
  .filter(([key]) => key.endsWith("node_modules/brace-expansion"))
  .map(([key, meta]) => ({ key, version: meta.version, dev: meta.dev === true }));
if (braceExpansionCopies.length === 0) fail("brace-expansion 설치 항목 없음");
for (const item of braceExpansionCopies) {
  if (!item.dev) fail(`${item.key}가 dev-only가 아님`);
  const major = String(item.version).split(".")[0];
  const floor = major === "1" ? "1.1.21" : major === "5" ? "5.0.12" : null;
  if (!floor || !atLeast(item.version, floor)) fail(`${item.key}=${item.version} < ${floor ?? "미검토"}`);
}

const bracesCopies = Object.entries(lock.packages ?? {})
  .filter(([key]) => key.endsWith("node_modules/braces"))
  .map(([key, meta]) => ({ key, version: meta.version, dev: meta.dev === true }));
if (bracesCopies.length === 0) fail("braces 설치 항목 없음");
for (const item of bracesCopies) if (!item.dev) fail(`${item.key}가 dev-only가 아님`);

const bracePolicy = policy.exceptions?.find((entry) => entry.id === "brace-expansion-eslint9-dev-only");
const globPolicy = policy.exceptions?.find((entry) => entry.id === "glob-toolchain-dev-only-20261118");
for (const entry of [bracePolicy, globPolicy]) {
  if (!entry || entry.scope !== "dev-only" || entry.expiresOn !== "2026-12-18") {
    fail(`검토한 dev-only 예외가 누락되거나 재검토 기한 불일치: ${entry?.id ?? "unknown"}`);
  }
}
for (const id of ["GHSA-mh99-v99m-4gvg", "GHSA-7r86-64r9-qc3w", "GHSA-VFJ7-8CJW-P6XM"]) {
  if (!bracePolicy.advisories.includes(id)) fail(`기존 예외 누락: ${id}`);
}
for (const id of ["GHSA-FC5Q-39XC-VJPF", "GHSA-G3HV-75WG-M249"]) {
  if (!globPolicy.advisories.includes(id)) fail(`신규 dev-only 예외 누락: ${id}`);
}
if (bracePolicy.requiredInstalledFloors?.["1"] !== "1.1.21"
    || bracePolicy.requiredInstalledFloors?.["5"] !== "5.0.12") {
  fail("brace-expansion 설치 버전 하한 정책 불일치");
}

console.log("보안 dependency/policy 검증 완료");
console.log(`- next ${next} / eslint-config-next ${eslintNext}`);
console.log(`- sharp ${sharp}`);
console.log(`- source-map-js ${[...new Set(sourceMapCopies.map((x) => x.version))].join(", ")}`);
console.log(`- brace-expansion ${[...new Set(braceExpansionCopies.map((x) => x.version))].join(", ")}`);
console.log(`- dev-only advisory 재검토 기한: ${globPolicy.expiresOn}`);
