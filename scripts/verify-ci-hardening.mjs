import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkoutSha = "11d5960a326750d5838078e36cf38b85af677262";
const setupNodeSha = "49933ea5288caeca8642d1e84afbd3f7d6820020";

const requiredFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/sync-im-not-ai.yml",
  ".github/workflows/dependency-audit.yml",
  "package.json",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`CI 강화 필수 파일 누락: ${file}`);
    process.exit(1);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.scripts?.lint !== "eslint --max-warnings=0") {
  console.error("ESLint zero-warning 게이트가 누락되었습니다.");
  process.exit(1);
}
if (
  packageJson.scripts?.validate
  !== "node scripts/verify-project.mjs && node scripts/verify-ci-hardening.mjs && npm run lint && npm run build"
) {
  console.error("validate에 CI 강화 계약 검사가 연결되어 있지 않습니다.");
  process.exit(1);
}

const ciWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
for (const marker of [
  "name: Quality and security CI",
  "push:",
  "pull_request:",
  "- main",
  "npm ci --audit=false",
  "npm run audit:production",
  "npm run audit:security",
  "npm run validate",
  `actions/checkout@${checkoutSha}`,
  `actions/setup-node@${setupNodeSha}`,
]) {
  if (!ciWorkflow.includes(marker)) {
    console.error(`일반 CI 계약 누락: ${marker}`);
    process.exit(1);
  }
}

for (const [file, title] of [
  [".github/workflows/sync-im-not-ai.yml", "im-not-ai 자동 동기화 실패 — 검토 필요"],
  [".github/workflows/dependency-audit.yml", "npm 보안 점검 실패 — 검토 필요"],
]) {
  const workflow = fs.readFileSync(path.join(root, file), "utf8");
  for (const marker of [
    "test_alert:",
    'description: "실패 알림 경로 테스트 (실제 GitHub Issue 생성)"',
    "default: false",
    "Simulate failure for alert-path test",
    "inputs.test_alert",
    'exit 1',
    "alert-path test:",
    title,
    "if: ${{ failure() }}",
    "if: ${{ success() }}",
    `actions/checkout@${checkoutSha}`,
    `actions/setup-node@${setupNodeSha}`,
  ]) {
    if (!workflow.includes(marker)) {
      console.error(`알림 실전 테스트 계약 누락: ${file} -> ${marker}`);
      process.exit(1);
    }
  }
}

const workflowDir = path.join(root, ".github/workflows");
for (const workflowName of fs.readdirSync(workflowDir).filter(
  (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
)) {
  const workflowText = fs.readFileSync(path.join(workflowDir, workflowName), "utf8");
  const usesPattern = /^\s*uses:\s*([^@\s]+)@([^\s#]+)/gm;
  let match;
  while ((match = usesPattern.exec(workflowText)) !== null) {
    const action = match[1];
    const ref = match[2];
    if (!action.startsWith("./") && !/^[0-9a-f]{40}$/.test(ref)) {
      console.error(`GitHub Action이 commit SHA로 고정되지 않았습니다: ${workflowName} -> ${action}@${ref}`);
      process.exit(1);
    }
  }
}

console.log("zero-warning lint · main/PR CI · 실패 알림 테스트 계약 검증 완료");
