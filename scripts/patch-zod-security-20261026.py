from pathlib import Path
import json

PACKAGE = Path("package.json")
VERIFY = Path("scripts/verify-project.mjs")

pkg = json.loads(PACKAGE.read_text(encoding="utf-8"))
overrides = pkg.get("overrides")
if overrides is None:
    overrides = {}
    pkg["overrides"] = overrides
elif not isinstance(overrides, dict):
    raise SystemExit("ERROR: package.json overrides가 object가 아닙니다.")

overrides["zod"] = "4.6.6"
PACKAGE.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("  package.json: overrides.zod = 4.6.6 적용 완료")

text = VERIFY.read_text(encoding="utf-8")
if 'const zodSecurityFloor = "4.6.6";' not in text:
    anchor = '''if (!versionAtLeast(installedNextPostcss, "8.5.23")) {
  console.error(`PostCSS 보안 패치 버전 미달: ${installedNextPostcss ?? "없음"} (최소 8.5.23)`);
  process.exit(1);
}

'''
    block = '''if (!versionAtLeast(installedNextPostcss, "8.5.23")) {
  console.error(`PostCSS 보안 패치 버전 미달: ${installedNextPostcss ?? "없음"} (최소 8.5.23)`);
  process.exit(1);
}

const zodSecurityFloor = "4.6.6";
const zodCopies = Object.entries(packageLock.packages ?? {})
  .filter(([packagePath]) => packagePath.endsWith("node_modules/zod"));

if (zodCopies.length === 0) {
  console.error("zod 설치 항목을 package-lock.json에서 찾지 못했습니다.");
  process.exit(1);
}

for (const [packagePath, metadata] of zodCopies) {
  if (!versionAtLeast(metadata.version, zodSecurityFloor)) {
    console.error(
      `Zod 보안 패치 버전 미달: ${packagePath} -> ${metadata.version ?? "없음"} (최소 ${zodSecurityFloor})`,
    );
    process.exit(1);
  }
}

if (packageJson.overrides?.zod !== zodSecurityFloor) {
  console.error(
    `Zod 보안 override 누락 또는 불일치: ${packageJson.overrides?.zod ?? "없음"} (필수 ${zodSecurityFloor})`,
  );
  process.exit(1);
}

'''
    if anchor not in text:
        raise SystemExit("ERROR: PostCSS 보안 floor 앵커를 찾지 못했습니다.")
    text = text.replace(anchor, block, 1)

VERIFY.write_text(text, encoding="utf-8")
print("  verify-project.mjs: zod >= 4.6.6 보안 floor 검증 추가 완료")
