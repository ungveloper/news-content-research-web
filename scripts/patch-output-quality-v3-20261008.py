from __future__ import annotations

from pathlib import Path
import json
import os
import re

WORKBENCH = Path("components/news-research-workbench.tsx")
PROMPT = Path("lib/research-package.ts")
OLD_HELPER = Path("lib/competition-risk.ts")

if not WORKBENCH.exists():
    raise SystemExit(f"ERROR: 대상 파일 없음: {WORKBENCH}")
if not PROMPT.exists():
    raise SystemExit(f"ERROR: 대상 파일 없음: {PROMPT}")

# ------------------------------------------------------------
# 1. 실제 opportunity 카드의 "예상 경쟁 위험" 표시를
#    큰 값 riskScore/100 -> 아래 riskLevel 형태로 맞춘다.
# ------------------------------------------------------------

text = WORKBENCH.read_text(encoding="utf-8")

# 이전 v8에서 group 카드 쪽에 잘못 삽입됐던 인라인 표시 제거.
text = re.sub(
    r'\{\s*" · 예상 경쟁 위험: "\s*\}\s*\{\s*formatCompetitionRisk\(group\)\s*\}',
    "",
    text,
)

# helper import가 더 이상 쓰이지 않으면 제거.
if "formatCompetitionRisk(" not in text:
    text = re.sub(
        r'^[ \t]*import\s*\{\s*formatCompetitionRisk\s*\}\s*from\s*["\'][^"\']*competition-risk["\'];[ \t]*\n',
        "",
        text,
        flags=re.M,
    )

card_anchor = text.find("feed.opportunities.map((item) =>")
if card_anchor < 0:
    raise SystemExit("ERROR: feed.opportunities.map((item) => 실제 카드 영역을 찾지 못했습니다.")

# 현재 실제 UI 문구는 "예상 경쟁 위험".
risk_match = re.search(
    r'<span>\s*예상 경쟁 위험\s*</span>',
    text[card_anchor:],
    flags=re.S,
)
if not risk_match:
    context = text[card_anchor:min(len(text), card_anchor + 12000)]
    raise SystemExit(
        "ERROR: 실제 opportunity 카드에서 '<span>예상 경쟁 위험</span>'을 찾지 못했습니다.\n"
        "--- context ---\n" + context + "\n--- end ---"
    )

risk_pos = card_anchor + risk_match.start()
window_end = min(len(text), risk_pos + 1600)
window = text[risk_pos:window_end]

score_match = re.search(
    r'<strong>\s*\{item\.competition\.riskScore\}\s*/\s*100\s*</strong>',
    window,
    flags=re.S,
)
if not score_match:
    raise SystemExit(
        "ERROR: 예상 경쟁 위험 카드의 큰 값 {item.competition.riskScore}/100을 확인하지 못했습니다.\n"
        "--- risk context ---\n" + window + "\n--- end ---"
    )

small_match = re.search(
    r'<small>(.*?)</small>',
    window,
    flags=re.S,
)
if not small_match:
    raise SystemExit(
        "ERROR: 예상 경쟁 위험 카드의 보조 <small> 영역을 찾지 못했습니다.\n"
        "--- risk context ---\n" + window + "\n--- end ---"
    )

small_inner = small_match.group(1).strip()

if "item.competition.riskLevel" not in small_inner:
    # 실제 현재 구조:
    # <small>블로그 결과 {item.competition.blogResultTotal?...}건</small>
    new_small_inner = "{item.competition.riskLevel} · " + small_inner
    abs_start = risk_pos + small_match.start(1)
    abs_end = risk_pos + small_match.end(1)
    text = text[:abs_start] + new_small_inner + text[abs_end:]
    print("  예상 경쟁 위험 카드: 큰 값 N/100 유지 + 아래 riskLevel 보조표시 추가 완료")
else:
    print("  예상 경쟁 위험 카드: 이미 N/100 → riskLevel 순서가 적용되어 있습니다.")

marker = "예상 경쟁 위험 카드 표시 계약: 큰 값 riskScore/100 → 보조 riskLevel"
if marker not in text:
    text += f"\n// {marker}\n"

WORKBENCH.write_text(text, encoding="utf-8")

# 사용되지 않는 helper 제거.
if OLD_HELPER.exists():
    referenced = False
    for root_name in ("app", "components", "lib"):
        root = Path(root_name)
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if not p.is_file() or p == OLD_HELPER or p.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
                continue
            try:
                content = p.read_text(encoding="utf-8")
            except Exception:
                continue
            if "competition-risk" in content or "formatCompetitionRisk" in content or "estimateCompetitionRisk" in content:
                referenced = True
                break
        if referenced:
            break

    if not referenced:
        OLD_HELPER.unlink()
        print("  사용되지 않는 lib/competition-risk.ts 제거 완료")

# ------------------------------------------------------------
# 2. 출력 위생 / 카테고리 / 태그 / 제목 규칙 삽입.
# ------------------------------------------------------------

prompt_text = PROMPT.read_text(encoding="utf-8")
rules = json.loads(os.environ["OUTPUT_QUALITY_RULES_JSON"])
rule_marker = "# 출력 위생·카테고리·태그·제목 우선 규칙 (2026-10-08 v3)"

if rule_marker in prompt_text:
    print("  research-package.ts: 출력 품질 v3 규칙이 이미 적용되어 있습니다.")
    raise SystemExit(0)

target = "# 1. 게시용 본문"
next_heading = "# 2. 게시 전 확인 자료"

positions = []
start = 0
while True:
    pos = prompt_text.find(target, start)
    if pos < 0:
        break
    positions.append(pos)
    start = pos + len(target)

if not positions:
    raise SystemExit("ERROR: '# 1. 게시용 본문' 위치를 찾지 못했습니다.")

def lexical_context(source: str, stop: int) -> str:
    CODE, SQ, DQ, TPL, LINE, BLOCK = "code", "sq", "dq", "tpl", "line", "block"
    state = CODE
    template_stack = []
    brace_depth = 0
    i = 0

    while i < stop:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < stop else ""

        if state == CODE:
            if ch == "/" and nxt == "/":
                state = LINE; i += 2; continue
            if ch == "/" and nxt == "*":
                state = BLOCK; i += 2; continue
            if ch == "'":
                state = SQ; i += 1; continue
            if ch == '"':
                state = DQ; i += 1; continue
            if ch == "`":
                state = TPL; i += 1; continue
            if template_stack:
                if ch == "{":
                    brace_depth += 1
                elif ch == "}":
                    brace_depth -= 1
                    if brace_depth == 0:
                        template_stack.pop()
                        state = TPL
                i += 1
                continue
            i += 1
            continue

        if state == LINE:
            if ch == "\n": state = CODE
            i += 1
            continue

        if state == BLOCK:
            if ch == "*" and nxt == "/":
                state = CODE; i += 2
            else:
                i += 1
            continue

        if state in (SQ, DQ):
            delim = "'" if state == SQ else '"'
            if ch == "\\":
                i += 2; continue
            if ch == delim:
                state = CODE
            i += 1
            continue

        if state == TPL:
            if ch == "\\":
                i += 2; continue
            if ch == "`":
                state = CODE; i += 1; continue
            if ch == "$" and nxt == "{":
                template_stack.append(True)
                brace_depth = 1
                state = CODE
                i += 2
                continue
            i += 1

    return state

ranked = []
for pos in positions:
    follow = prompt_text.find(next_heading, pos + len(target))
    distance = follow - pos if follow >= 0 else 10**9
    ranked.append((distance, pos, lexical_context(prompt_text, pos)))

ranked.sort()
distance, pos, ctx = ranked[0]

if distance > 50000:
    raise SystemExit("ERROR: 같은 출력 블록의 '# 2. 게시 전 확인 자료'를 가까이서 찾지 못했습니다.")

if ctx == "tpl":
    insertion = rules.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
elif ctx == "dq":
    insertion = rules.replace("\\", "\\\\").replace('"', '\\"').replace("\r", "\\r").replace("\n", "\\n")
elif ctx == "sq":
    insertion = rules.replace("\\", "\\\\").replace("'", "\\'").replace("\r", "\\r").replace("\n", "\\n")
else:
    raise SystemExit(f"ERROR: 안전한 문자열 문맥을 확정하지 못했습니다(context={ctx}).")

prompt_text = prompt_text[:pos] + insertion + prompt_text[pos:]
PROMPT.write_text(prompt_text, encoding="utf-8")

print(
    "  research-package.ts: 카테고리 단일값·태그 3~5개·제목 콜론 규칙 적용 완료 "
    f"(문맥={ctx}, 출력 블록 거리={distance})"
)
