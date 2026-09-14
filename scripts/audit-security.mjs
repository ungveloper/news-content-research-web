import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const policy = JSON.parse(
  fs.readFileSync(path.join(root, ".security/npm-audit-exceptions.json"), "utf8"),
);

const exception = policy.exceptions?.find(
  (entry) => entry.id === "brace-expansion-eslint9-dev-only",
);
if (!exception) {
  console.error("npm audit 예외 정책이 없습니다.");
  process.exit(1);
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
      throw new Error(
        `허용된 brace-expansion 예외는 dev-only여야 합니다: ${item.packagePath} ${item.version ?? "unknown"}`,
      );
    }

    const major = String(item.version).split(".")[0];
    const floor = exception.requiredInstalledFloors?.[major];
    if (!floor) {
      throw new Error(
        `검토되지 않은 brace-expansion major가 설치됐습니다: ${item.version} (${item.packagePath})`,
      );
    }
    if (compareVersions(item.version, floor) < 0) {
      throw new Error(
        `brace-expansion 보안 floor 미달: ${item.version} < ${floor} (${item.packagePath})`,
      );
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
      for (const id of advisoryIdsFor(via, vulnerabilities, seen)) ids.add(id);
      continue;
    }

    const haystack = [
      via.url,
      via.title,
      via.name,
      via.source ? String(via.source) : "",
    ].filter(Boolean).join(" ");

    const matches = haystack.match(/GHSA-[0-9a-z-]+/gi) ?? [];
    if (matches.length === 0) {
      ids.add(`unknown-advisory:${via.name ?? name}:${via.source ?? "no-source"}`);
    } else {
      for (const match of matches) ids.add(match.toUpperCase());
    }
  }

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
  { cwd: root, encoding: "utf8" },
);

let report;
try {
  report = JSON.parse(fullAudit.stdout || "{}");
} catch (error) {
  console.error("npm audit JSON을 해석하지 못했습니다.");
  if (fullAudit.stderr) console.error(fullAudit.stderr.trim());
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const allowedAdvisories = new Set(
  (exception.advisories ?? []).map((value) => value.toUpperCase()),
);
const tolerated = [];
const unexpected = [];

for (const [name, value] of serious) {
  if (value.severity === "critical" || !allNodesAreDev(value)) {
    unexpected.push({ name, value, reason: "critical 또는 production/runtime 경로" });
    continue;
  }

  const ids = advisoryIdsFor(name, vulnerabilities);
  const idsArray = [...ids];
  const allowed =
    idsArray.length > 0
    && idsArray.every((id) => allowedAdvisories.has(id));

  if (!allowed) {
    unexpected.push({
      name,
      value,
      reason: `허용되지 않은 advisory: ${idsArray.join(", ") || "식별 실패"}`,
    });
    continue;
  }

  tolerated.push({ name, value, ids: idsArray });
}

if (tolerated.length > 0) {
  const expiry = new Date(`${exception.expiresOn}T23:59:59Z`);
  if (!Number.isFinite(expiry.getTime()) || new Date() > expiry) {
    console.error(
      `dev-only npm audit 예외의 재검토 기한(${exception.expiresOn})이 지났습니다. 정책을 다시 검토하세요.`,
    );
    process.exit(1);
  }

  console.warn(
    `npm full audit: 알려진 dev-only ESLint/brace-expansion advisory 체인 ${tolerated.length}건을 기한부 허용합니다.`,
  );
  console.warn(`재검토 기한: ${exception.expiresOn}`);
  console.warn(
    `brace-expansion 설치 버전: ${installedBrace.map((item) => item.version).join(", ")}`,
  );
  for (const item of tolerated) {
    console.warn(`- ${item.name}: ${item.value.severity} · ${item.ids.join(", ")}`);
  }
}

if (unexpected.length > 0) {
  console.error("허용되지 않은 high/critical npm 취약점이 있습니다:");
  for (const item of unexpected) {
    console.error(`- ${item.name}: ${item.value.severity} · ${item.reason}`);
  }
  process.exit(1);
}

console.log("npm security policy: production high/critical 없음, 허용된 dev-only 예외만 존재");
