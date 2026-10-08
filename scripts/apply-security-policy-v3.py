from pathlib import Path
import json

pkg_path = Path("package.json")
policy_path = Path(".security/npm-audit-exceptions.json")

pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
policy = json.loads(policy_path.read_text(encoding="utf-8"))

groups = ("dependencies", "devDependencies", "optionalDependencies")

def set_direct_if_present(name: str, version: str) -> bool:
    found = False
    for group in groups:
        deps = pkg.get(group)
        if isinstance(deps, dict) and name in deps:
            deps[name] = version
            found = True
    return found

if not set_direct_if_present("next", "16.4.0"):
    raise SystemExit("ERROR: direct dependency next를 찾지 못했습니다.")

if not set_direct_if_present("eslint-config-next", "16.4.0"):
    raise SystemExit("ERROR: devDependency eslint-config-next를 찾지 못했습니다.")

# Runtime/transitive floors that are already patchable.
overrides = pkg.get("overrides")
if overrides is None:
    overrides = {}
    pkg["overrides"] = overrides
elif not isinstance(overrides, dict):
    raise SystemExit("ERROR: package.json overrides가 object가 아닙니다.")

overrides["sharp"] = "0.35.5"
overrides["source-map-js"] = "1.2.2"

pkg_path.write_text(
    json.dumps(pkg, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

exceptions = policy.get("exceptions")
if not isinstance(exceptions, list):
    raise SystemExit("ERROR: npm audit exceptions 배열이 없습니다.")

entry = next(
    (item for item in exceptions if item.get("id") == "brace-expansion-eslint9-dev-only"),
    None,
)
if entry is None:
    raise SystemExit("ERROR: 기존 brace-expansion-eslint9-dev-only 정책을 찾지 못했습니다.")

advisories = list(dict.fromkeys([
    *(entry.get("advisories") or []),
    "GHSA-VFJ7-8CJW-P6XM",
]))

entry["advisories"] = advisories
entry["requiredInstalledFloors"] = {
    "1": "1.1.21",
    "5": "5.0.12",
}
entry["expiresOn"] = "2026-11-15"
entry["rationale"] = (
    "ESLint 9/minimatch 3 requires the brace-expansion 1.x CommonJS API, so the "
    "1.x and 5.x brace-expansion lines are kept line-compatible but advanced to "
    "their current patched floors (1.1.21 and 5.0.12). The remaining "
    "GHSA-VFJ7-8CJW-P6XM advisory is in braces <=3.0.3, currently has no patched "
    "npm release, and is tolerated only when npm audit reports the entire chain "
    "as dev-only. scripts/audit-security.mjs fails closed for production/runtime "
    "paths, critical findings, unknown advisories, expired exceptions, or "
    "brace-expansion floors below policy."
)

policy_path.write_text(
    json.dumps(policy, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

print("  package.json + npm audit 정책 업데이트 완료")
print("   - next / eslint-config-next: 16.4.0")
print("   - sharp override: 0.35.5")
print("   - source-map-js override: 1.2.2")
print("   - brace-expansion floor: 1.x >=1.1.21 / 5.x >=5.0.12")
print("   - braces GHSA-VFJ7-8CJW-P6XM: dev-only + 2026-11-15 기한부 예외")
