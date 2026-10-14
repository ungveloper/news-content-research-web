from pathlib import Path
import json, os

TARGET = Path("lib/research-package.ts")
if not TARGET.exists():
    raise SystemExit(f"ERROR: 대상 파일 없음: {TARGET}")

text = TARGET.read_text(encoding="utf-8")
rules = json.loads(os.environ["SOURCE_NUMBERING_RULES_JSON"])
marker = "# 출처 소제목별 번호 초기화 규칙 (2026-10-14)"

if marker in text:
    print("  research-package.ts: 출처 소제목별 번호 초기화 규칙이 이미 적용되어 있습니다.")
    raise SystemExit(0)

target = "# 1. 게시용 본문"
positions = []
start = 0
while True:
    pos = text.find(target, start)
    if pos < 0:
        break
    positions.append(pos)
    start = pos + len(target)

if not positions:
    raise SystemExit("ERROR: '# 1. 게시용 본문' 앵커를 찾지 못했습니다.")

def lexical_context(source, stop):
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
                i += 1; continue
            i += 1; continue
        if state == LINE:
            if ch == "\n": state = CODE
            i += 1; continue
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
            i += 1; continue
        if state == TPL:
            if ch == "\\":
                i += 2; continue
            if ch == "`":
                state = CODE; i += 1; continue
            if ch == "$" and nxt == "{":
                template_stack.append(True)
                brace_depth = 1
                state = CODE
                i += 2; continue
            i += 1
    return state

ranked = []
for pos in positions:
    follow = text.find("# 2. 게시 전 확인 자료", pos + len(target))
    distance = follow - pos if follow >= 0 else 10**9
    ranked.append((distance, pos, lexical_context(text, pos)))
ranked.sort()
distance, pos, ctx = ranked[0]

if distance > 50000:
    raise SystemExit("ERROR: 동일 출력 블록의 '# 2. 게시 전 확인 자료'를 가까이서 찾지 못했습니다.")

if ctx == "tpl":
    insertion = rules.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
elif ctx == "dq":
    insertion = rules.replace("\\", "\\\\").replace('"', '\\"').replace("\r", "\\r").replace("\n", "\\n")
elif ctx == "sq":
    insertion = rules.replace("\\", "\\\\").replace("'", "\\'").replace("\r", "\\r").replace("\n", "\\n")
else:
    raise SystemExit(f"ERROR: 안전한 문자열 문맥을 확정하지 못했습니다(context={ctx}).")

text = text[:pos] + insertion + text[pos:]
TARGET.write_text(text, encoding="utf-8")
print(f"  research-package.ts: 출처 소제목별 번호 초기화 규칙 적용 완료 (문맥={ctx}, 출력 블록 거리={distance})")
