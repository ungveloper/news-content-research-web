import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "epoko77-ai/im-not-ai";
const REF = "main";
const SKILL_PATH = "skills/humanize-korean/SKILL.md";
const QUICK_RULES_PATH = "skills/humanize-korean/references/quick-rules.md";
const LICENSE_PATH = "LICENSE";

const MIN_QUICK_RULES_BYTES = 4_000;
const MAX_QUICK_RULES_BYTES = 128_000;
const MAX_RELATIVE_LENGTH_CHANGE = 0.75;
const MAX_LICENSE_BYTES = 32_000;

const REQUIRED_QUICK_RULE_MARKERS = [
  "# Quick Rules",
  "**Do-NOT",
  "**내용 앵커",
  "**과윤문 가드",
  "## A.",
  "## C.",
  "## D.",
];

const SUSPICIOUS_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /disregard[\s\S]{0,80}instructions/i,
  /이전\s+(?:모든\s+)?(?:지시|명령)[\s\S]{0,40}무시/,
  /(?:시스템|개발자)\s*(?:프롬프트|메시지|지시)[\s\S]{0,40}무시/,
  /\brm\s+-rf\b/i,
  /\bcurl\s+https?:\/\//i,
  /\bwget\s+https?:\/\//i,
  /<script\b/i,
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const generatedPath = resolve(root, "lib/im-not-ai.generated.ts");
const licensePath = resolve(root, "third_party/im-not-ai/LICENSE");
const statePath = resolve(root, "third_party/im-not-ai/sync-state.json");

function headers() {
  const result = {
    Accept: "application/vnd.github+json",
    "User-Agent": "news-content-research-web-im-not-ai-sync",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    result.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return result;
}

function envFlag(name) {
  return ["1", "true", "yes"].includes(String(process.env[name] ?? "").toLowerCase());
}

async function fetchGithubText(path) {
  const url = `https://api.github.com/repos/${REPOSITORY}/contents/${path}?ref=${encodeURIComponent(REF)}`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub fetch failed (${response.status}) for ${path}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  if (!payload || payload.type !== "file" || payload.encoding !== "base64" || !payload.content || !payload.sha) {
    throw new Error(`Unexpected GitHub contents response for ${path}`);
  }

  return {
    sha: payload.sha,
    text: Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

function parseSkillVersion(skillText) {
  const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/);
  const version = frontmatter?.[1]?.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim();
  if (!version) throw new Error("Could not parse humanize-korean version from SKILL.md");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Unexpected humanize-korean version format: ${version}`);
  }
  return version;
}

function majorOf(version) {
  return Number(version.split(".", 1)[0]);
}

function parseGeneratedSnapshot(source) {
  function readString(name) {
    const match = source.match(new RegExp(`^export const ${name} = (.+);$`, "m"));
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  return {
    version: readString("IM_NOT_AI_SKILL_VERSION"),
    skillBlobSha: readString("IM_NOT_AI_SKILL_BLOB_SHA"),
    quickRulesBlobSha: readString("IM_NOT_AI_QUICK_RULES_BLOB_SHA"),
    quickRules: readString("IM_NOT_AI_QUICK_RULES"),
  };
}

async function readExistingSnapshot() {
  let generatedSource = "";
  try {
    generatedSource = await readFile(generatedPath, "utf8");
  } catch {
    return { state: null, generated: null };
  }

  let state = null;
  try {
    state = JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    // First run after introducing sync-state.json.
  }

  return {
    state,
    generated: parseGeneratedSnapshot(generatedSource),
  };
}

function validateQuickRules({ version, quickRules, previous }) {
  const byteLength = Buffer.byteLength(quickRules.text, "utf8");
  if (byteLength < MIN_QUICK_RULES_BYTES || byteLength > MAX_QUICK_RULES_BYTES) {
    throw new Error(`Refusing im-not-ai update: quick-rules size ${byteLength} bytes is outside ${MIN_QUICK_RULES_BYTES}-${MAX_QUICK_RULES_BYTES}`);
  }

  for (const marker of REQUIRED_QUICK_RULE_MARKERS) {
    if (!quickRules.text.includes(marker)) {
      throw new Error(`Refusing im-not-ai update: required quick-rules marker disappeared: ${marker}`);
    }
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(quickRules.text)) {
      throw new Error(`Refusing im-not-ai update: suspicious instruction pattern detected: ${pattern}`);
    }
  }

  if (previous?.version && majorOf(previous.version) !== majorOf(version) && !envFlag("IM_NOT_AI_ALLOW_MAJOR_CHANGE")) {
    throw new Error(
      `Refusing automatic major update ${previous.version} -> ${version}. Review upstream first, then rerun manually with IM_NOT_AI_ALLOW_MAJOR_CHANGE=1.`,
    );
  }

  if (previous?.quickRules) {
    const previousLength = Buffer.byteLength(previous.quickRules, "utf8");
    const relativeChange = Math.abs(byteLength - previousLength) / Math.max(previousLength, 1);
    if (relativeChange > MAX_RELATIVE_LENGTH_CHANGE && !envFlag("IM_NOT_AI_ALLOW_LARGE_CHANGE")) {
      throw new Error(
        `Refusing unusually large quick-rules size change (${(relativeChange * 100).toFixed(1)}%). Review upstream first, then rerun manually with IM_NOT_AI_ALLOW_LARGE_CHANGE=1.`,
      );
    }
  }
}

function validateLicense(licenseText) {
  const byteLength = Buffer.byteLength(licenseText, "utf8");
  if (byteLength === 0 || byteLength > MAX_LICENSE_BYTES || !licenseText.includes("MIT License")) {
    throw new Error("Refusing im-not-ai update: upstream LICENSE is missing, too large, or no longer MIT text");
  }
}

function buildGenerated({ version, skillSha, quickRulesSha, quickRules }) {
  return `/**\n * AUTO-GENERATED by scripts/sync-im-not-ai.mjs.\n * Source: https://github.com/${REPOSITORY}\n * Do not edit manually.\n */\nexport const IM_NOT_AI_SOURCE_REPOSITORY = ${JSON.stringify(REPOSITORY)};\nexport const IM_NOT_AI_SOURCE_REF = ${JSON.stringify(REF)};\nexport const IM_NOT_AI_SKILL_VERSION = ${JSON.stringify(version)};\nexport const IM_NOT_AI_SKILL_BLOB_SHA = ${JSON.stringify(skillSha)};\nexport const IM_NOT_AI_QUICK_RULES_BLOB_SHA = ${JSON.stringify(quickRulesSha)};\nexport const IM_NOT_AI_QUICK_RULES = ${JSON.stringify(quickRules)};\n`;
}

function buildState({ version, skillSha, quickRulesSha, previousState, previousGenerated }) {
  const current = {
    version,
    skillBlobSha: skillSha,
    quickRulesBlobSha: quickRulesSha,
  };

  const oldCurrent = previousState?.current ?? (
    previousGenerated?.version && previousGenerated?.skillBlobSha && previousGenerated?.quickRulesBlobSha
      ? {
          version: previousGenerated.version,
          skillBlobSha: previousGenerated.skillBlobSha,
          quickRulesBlobSha: previousGenerated.quickRulesBlobSha,
        }
      : null
  );

  const unchanged = oldCurrent
    && oldCurrent.version === current.version
    && oldCurrent.skillBlobSha === current.skillBlobSha
    && oldCurrent.quickRulesBlobSha === current.quickRulesBlobSha;

  return {
    repository: REPOSITORY,
    ref: REF,
    current,
    previous: unchanged ? (previousState?.previous ?? null) : oldCurrent,
  };
}

async function writeIfChanged(path, content) {
  let previous = null;
  try {
    previous = await readFile(path, "utf8");
  } catch {
    // First sync.
  }
  if (previous === content) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return true;
}

async function main() {
  const existing = await readExistingSnapshot();
  const previous = existing.generated;

  const [skill, quickRules, license] = await Promise.all([
    fetchGithubText(SKILL_PATH),
    fetchGithubText(QUICK_RULES_PATH),
    fetchGithubText(LICENSE_PATH),
  ]);

  const version = parseSkillVersion(skill.text);
  validateQuickRules({ version, quickRules, previous });
  validateLicense(license.text);

  const generated = buildGenerated({
    version,
    skillSha: skill.sha,
    quickRulesSha: quickRules.sha,
    quickRules: quickRules.text,
  });
  const state = buildState({
    version,
    skillSha: skill.sha,
    quickRulesSha: quickRules.sha,
    previousState: existing.state,
    previousGenerated: existing.generated,
  });

  const [generatedChanged, licenseChanged, stateChanged] = await Promise.all([
    writeIfChanged(generatedPath, generated),
    writeIfChanged(licensePath, license.text.endsWith("\n") ? license.text : `${license.text}\n`),
    writeIfChanged(statePath, `${JSON.stringify(state, null, 2)}\n`),
  ]);

  console.log(`im-not-ai humanize-korean v${version}`);
  console.log(`SKILL blob: ${skill.sha}`);
  console.log(`quick-rules blob: ${quickRules.sha}`);
  console.log(generatedChanged || licenseChanged || stateChanged ? "updated local snapshot" : "already up to date");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
