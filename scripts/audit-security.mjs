import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const policy = JSON.parse(
  fs.readFileSync(path.join(root, ".security/npm-audit-exceptions.json"), "utf8"),
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const exceptions = policy.exceptions;
if (!Array.isArray(exceptions) || exceptions.length === 0) {
  fail("npm audit 예외 정책이 없습니다.");
}

const allowedByAdvisory = new Map();
for (const exception of exceptions) {
  if (
    exception.scope !== "dev-only"
    || !Array.isArray(exception.advisories)
    || exception.advisories.length === 0
  ) {
    fail(`검토되지 않은 audit 예외 정책: ${exception.id ?? "unknown"}`);
  }
  const expiry = new Date(`${exception.expiresOn}T23:59:59Z`);
  if (!Number.isFinite(expiry.getTime())) {
    fail(`예외 정책의 재검토 기한이 잘못되었습니다: ${exception.id}`);
  }
  for (const value of exception.advisories) {
    const id = String(value).toUpperCase();
    if (!/^GHSA-[0-9A-Z-]+$/.test(id) || allowedByAdvisory.has(id)) {
      fail(`중복 또는 잘못된 advisory 예외: ${id}`);
    }
    allowedByAdvisory.set(id, { exception, expiry });
  }
}

const bracePolicy = exceptions.find(
  (entry) => entry.id === "brace-expansion-eslint9-dev-only",
);
if (!bracePolicy || !bracePolicy.requiredInstalledFloors) {
  fail("brace-expansion 버전 하한 정책이 누락되었습니다.");
}

function compareVersions(actual, minimum) {
  const a = String(actual).split("-")[0].split(".").map(Number);
  const b = String(minimum).split("-")[0].split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

function checkBraceExpansionFloors() {
  const installed = Object.entries(lock.packages ?? {})
    .filter(([packagePath]) => packagePath.endsWith("node_modules/brace-expansion"))
    .map(([packagePath, metadata]) => ({
      packagePath,
      version: metadata.version,
      dev: metadata.dev === true,
    }));
  if (installed.length === 0) {
    throw new Error("brace-expansion 설치 항목을 package-lock.json에서 찾지 못했습니다.");
  }
  for (const item of installed) {
    if (!item.version || !item.dev) {
      throw new Error(`brace-expansion의 production/runtime 경로가 감지되었습니다: ${item.packagePath}`);
    }
    const major = String(item.version).split(".")[0];
    const floor = bracePolicy.requiredInstalledFloors[major];
    if (!floor || compareVersions(item.version, floor) < 0) {
      throw new Error(`brace-expansion 보안 버전 하한 미달 또는 미검토: ${item.version} (${item.packagePath})`);
    }
  }
  return installed;
}

function advisoryIdsFor(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const value = vulnerabilities[name];
  if (!value) return new Set([`unknown-package:${name}`]);
  const ids = new Set();
  for (const via of value.via ?? []) {
    if (typeof via === "string") {
      for (const id of advisoryIdsFor(via, vulnerabilities, new Set(seen))) ids.add(id);
      continue;
    }
    const haystack = [via.url, via.title, via.name, via.source ? String(via.source) : ""]
      .filter(Boolean).join(" ");
    const matches = haystack.match(/GHSA-[0-9a-z-]+/gi) ?? [];
    if (matches.length === 0) {
      ids.add(`unknown-advisory:${via.name ?? name}:${via.source ?? "no-source"}`);
    } else {
      for (const match of matches) ids.add(match.toUpperCase());
    }
  }
  if (ids.size === 0) ids.add(`unknown-advisory:${name}:empty-via`);
  return ids;
}

function allNodesAreDev(value) {
  const nodes = value.nodes ?? [];
  if (nodes.length === 0) return false;
  return nodes.every((nodePath) => lock.packages?.[nodePath]?.dev === true);
}

const fullAudit = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--package-lock-only", "--json"],
  { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);

if (fullAudit.error) fail(`npm audit 실행 실패: ${fullAudit.error.message}`);
let report;
try {
  report = JSON.parse(fullAudit.stdout || "{}");
} catch {
  fail(`npm audit JSON을 해석하지 못했습니다: ${fullAudit.stderr?.trim() ?? ""}`);
}
if (
  !report
  || typeof report.vulnerabilities !== "object"
  || report.vulnerabilities === null
  || !report.metadata?.vulnerabilities
  || report.error
  || (fullAudit.status !== 0 && fullAudit.status !== 1)
) {
  fail(`npm audit 정상 응답을 받지 못했습니다: ${JSON.stringify(report.error ?? report.message ?? fullAudit.stderr ?? "unknown").slice(0, 600)}`);
}

const vulnerabilities = report.vulnerabilities;
const serious = Object.entries(vulnerabilities).filter(([, value]) =>
  ["high", "critical"].includes(value.severity),
);
if (serious.length === 0) {
  console.log("npm full audit: high/critical 취약점 없음");
  process.exit(0);
}

let installedBrace;
try {
  installedBrace = checkBraceExpansionFloors();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const tolerated = [];
const unexpected = [];
for (const [name, value] of serious) {
  if (value.severity === "critical" || !allNodesAreDev(value)) {
    unexpected.push({ name, value, reason: "critical 또는 production/runtime 경로" });
    continue;
  }
  const ids = [...advisoryIdsFor(name, vulnerabilities)];
  const unreviewed = ids.filter((id) => !allowedByAdvisory.has(id));
  if (unreviewed.length > 0) {
    unexpected.push({ name, value, reason: `허용되지 않은 advisory: ${unreviewed.join(", ")}` });
    continue;
  }
  const expired = ids.filter((id) => new Date() > allowedByAdvisory.get(id).expiry);
  if (expired.length > 0) {
    unexpected.push({ name, value, reason: `재검토 기한 만료: ${expired.join(", ")}` });
    continue;
  }
  tolerated.push({ name, value, ids });
}

if (tolerated.length > 0) {
  console.warn(`npm full audit: 검토된 dev-only advisory 체인 ${tolerated.length}건을 기한부 허용합니다.`);
  console.warn(`brace-expansion 설치 버전: ${installedBrace.map((item) => item.version).join(", ")}`);
  for (const item of tolerated) {
    const deadlines = item.ids.map((id) => `${id} (${allowedByAdvisory.get(id).exception.expiresOn})`);
    console.warn(`- ${item.name}: ${item.value.severity} · ${deadlines.join(", ")}`);
  }
}
if (unexpected.length > 0) {
  console.error("허용되지 않은 high/critical npm 취약점이 있습니다:");
  for (const item of unexpected) {
    console.error(`- ${item.name}: ${item.value.severity} · ${item.reason}`);
  }
  process.exit(1);
}
console.log("npm security policy: production high/critical 없음, 검토된 dev-only 예외만 존재");
