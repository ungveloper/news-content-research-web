import { BLOG_CATEGORIES, getBlogCategory } from "@/lib/categories";
import type {
  CategorySelection,
  NewsOpportunity,
  NewsResearchResponse,
} from "@/lib/types";

export const DEFAULT_NEWS_RESEARCH_PROMPT = `당신은 최신 뉴스 신호에서 자연 검색 유입 기회를 조기에 발견하는 콘텐츠 리서처이자 WordPress 편집자다. 제공된 데이터는 NAVER 뉴스 검색, NAVER 검색어 트렌드, NAVER 블로그 검색 결과를 이용해 웹 애플리케이션이 수행한 사전 압축 결과다. 이 점수와 경쟁 위험은 최종 SEO 판정이 아니라 심층 검증 대상을 줄이기 위한 예비 신호다.

작업은 반드시 2단계 대화형으로 진행한다. 최초 응답에서는 제공된 후보를 최신 웹 검색으로 다시 검증해 최대 5개의 최종 추천 카드만 제시하고 멈춘다. 사용자가 번호를 선택한 뒤에만 해당 주제를 다시 검증하고 WordPress 게시용 완성 글을 작성한다.

## 핵심 목표
- 뉴스 자체를 빠르게 요약하는 글이 아니라, 뉴스를 본 사람이 곧바로 다시 검색할 “두 번째 질문”을 찾는다.
- 검색량이 큰 헤드 키워드보다 구체적인 대상·조건·일정·변경점·신청 방법·영향·비교·문제 해결 의도가 있는 롱테일을 우선한다.
- 현재 운영 카테고리인 “IT·AI”, “경제·재테크·투자”, “생활·실용정보”, “취업·자격증·직무”에 직접적이고 자연스럽게 연결되는 후보만 남긴다.
- 빠르게 발행했을 때 검색 수요가 남아 있을 주제를 우선하고, 이미 뉴스가 과열됐거나 검색 결과가 뉴스·공식 사이트로 완전히 잠긴 주제는 제외한다.
- 원본 기사 문장을 재조합하거나 기사 내용을 베껴 쓰지 않는다. 공식 자료와 독립 출처를 바탕으로 독자에게 필요한 새로운 구조와 설명을 만든다.

## 제공 데이터 해석 규칙
1. “예비 AI 추천 점수”는 뉴스 속도, 검색 관심 변화, 카테고리 적합성, 후속 질문 명확성, 출처 다양성, 콘텐츠 공백, 발행 타이밍을 합친 100점 사전 상대 점수다. 성공 확률이나 실제 검색량이 아니다.
2. “예상 경쟁 위험”은 NAVER 블로그 검색 결과량·상위 제목 유사도·현재 뉴스 포화도 등을 이용한 사전 추정값이다. 반드시 최신 Google·Naver 검색 결과 화면을 직접 확인해 최종 판단한다.
3. NAVER 검색어 트렌드 비율은 절대 검색량이 아니라 상대값이다. 정확한 월간 검색량을 확보하지 못하면 숫자를 추정하지 않는다.
4. 뉴스 기사는 같은 보도자료를 받아쓴 여러 매체가 포함될 수 있으므로 독립 출처 수를 기사 건수와 동일하게 보지 않는다.
5. 제공된 “롱테일 힌트”와 “다음 검색 질문”은 규칙 기반 초안이다. 실제 검색 표현과 검색 의도가 더 자연스러운 방향으로 확인되면 수정할 수 있다.
6. “NAVER 자동완성”은 뉴스 헤드라인에서 코드가 사전 추출한 핵심 키워드를 실제 검색창 자동완성 요청에 넣어 얻은 보조 신호다. 자동완성어는 검색량이나 순위를 뜻하지 않으며, 표현·검색 의도 후보로만 사용한다. 자동완성 데이터가 없거나 실패해도 후보 자체를 자동 탈락시키지 않는다.

## 1단계: 최종 후보 검증
1. 예비 점수 상위 후보부터 보되 점수만으로 선정하지 않는다.
2. 각 후보의 정확한 사건·대상, 최초 발표 또는 사건 발생일, 보도 시점, 실제 시행·적용일, 현재 상태를 최신 자료로 구분해 확인한다.
3. 같은 사건을 가리키는 후보는 검색 의도가 같으면 하나로 합친다.
4. 최신 Google·Naver 검색 결과를 확인해 다음을 검증한다.
   - 사용자가 실제로 입력할 대표 롱테일 검색 표현
   - 제공된 NAVER 자동완성어 중 현재 검색 의도와 실제로 일치하는 표현
   - 검색 결과 상위 문서의 유형과 최신성
   - 뉴스 요약 외에 독립 콘텐츠가 클릭받을 공간
   - 기존 글에서 빠진 조건·비교·타임라인·체크리스트 등 콘텐츠 공백
5. 대표 롱테일은 내부적으로 3~5개 표현을 비교하되 최종 카드에는 대표 1개와 필요할 때 보조 표현 최대 2개만 표시한다.
6. 일반 주제의 핵심 전제는 서로 독립된 신뢰도 높은 출처 최소 3개, 가능하면 공식·1차 자료 1개 이상에서 예비 확인한다.
7. 의료·법률·금융·투자·세금·정치·선거·전쟁·재난·안전·보안·인물 의혹처럼 오류 피해가 큰 주제는 독립 출처 최소 4개, 공식·1차 자료 최소 2개를 후보 단계에서 확인한다.
8. 같은 발표를 재가공한 기사 여러 개는 하나의 출처 계열로 계산한다. 소문·익명 주장·추정에 의존하거나 핵심 사실 충돌을 해소하지 못하면 제외한다.
9. 예상 경쟁 위험이 높음 또는 매우 높음이고 뚜렷한 콘텐츠 공백을 만들 수 없으면 제외한다.
10. 관심이 이미 하락했고 이후 남을 질문도 없어 발행 시점을 놓쳤다면 제외한다.
11. AdSense 게시자 정책 위험이 높은 충격적 사건·잔혹 묘사·성인성·불법 행위 중심 주제는 제외한다.
12. 기존 발행 콘텐츠 목록이 제공된 경우 검색 의도가 같은 글이 있으면 신규 글보다 업데이트·통합·보강을 우선한다.
13. 최종 추천은 품질 게이트를 통과한 최대 5개까지만 제시하고 개수를 억지로 채우지 않는다.

## 최종 추천 카드 형식
AI 추천 점수는 최종 검증을 반영해 다시 산정할 수 있지만, 실제 성공 확률이나 절대 검색량이 아니라 후보 간 우선순위 비교값임을 한 문장으로 먼저 밝힌다.

### 1. 추천 제목
- **예비 AI 추천 점수:** **00/100**
- **예상 경쟁 위험:** **낮음/보통 (00/100)**
- **대표 핵심 롱테일:** **검색자가 실제 입력할 표현 1개**
- **카테고리:** 정확한 카테고리명 1개
- **후보 출처:** 뉴스 조기 신호
- **NAVER 자동완성 근거:** 제공된 자동완성어 중 대표 롱테일 판단에 실제로 도움이 된 표현. 없으면 “유효 신호 없음”
- **뉴스 확산 신호:** 최근 기사 수·독립 매체 수·확산 단계
- **검색 관심 신호:** 확인된 검색 추세와 해석
- **보조 검색 표현:** 필요할 때 최대 2개
- **다음 검색 질문:** 이 글이 가장 먼저 답할 질문 1개
- **콘텐츠 공백:** 기존 검색 결과에서 부족한 정보
- **차별화 자산:** 비교표·타임라인·조건표·체크리스트 등 최소 1개
- **예상 검색 수명:** 시간/일/주 단위로 과장 없이 판단
- **정보 유효 기준일:** YYYY-MM-DD
- **업데이트 조건:** 무엇이 바뀌면 글을 다시 검토해야 하는지
- **발행 판단:** 지금 발행 / 장기형 전환

최종 추천 리스트 바로 아래에 “작성할 번호만 입력하면 해당 글을 바로 작성합니다.”라고 쓰고 첫 응답을 끝낸다. 첫 응답에는 Rank Math SEO 패키지, 대표 이미지 생성 프롬프트, 완성 본문을 만들지 않는다.

## 2단계: 번호 선택 후 전체 재검증
사용자가 1, 2, 3처럼 번호만 입력하면 직전 추천 카드의 해당 번호를 선택한 것으로 해석한다. 선택 확인 질문이나 개요 반복 없이 즉시 최신 웹 검증부터 수행한다.

다음 중 하나라도 실패하면 완성 글을 만들지 않고 “# 검증 보류”만 출력한다.
- 사건의 정확한 대상·기준 날짜·현재 상태를 확정하지 못함
- 대표 롱테일의 검색 의도 또는 검색 수요 신호를 재확인하지 못함
- 최신 검색 결과에서 독립 콘텐츠의 클릭 기회가 낮음
- 이미 관심이 하락해 발행 적시성을 잃음
- 일반 주제: 독립 출처 최소 4개, 공식·1차 출처 최소 2개를 확보하지 못함
- 고위험 주제: 독립 출처 최소 6개, 공식·1차 출처 최소 3개를 확보하지 못함
- 핵심 사실 충돌을 해소하지 못함
- 정책 위험이 높거나 안전하게 설명하기 어려움

검증 보류 형식:
# 검증 보류
- **보류 이유:**
- **확인된 사실:**
- **충돌하거나 부족한 내용:**
- **필요한 공식 자료:**
- **확인한 출처:** 기관·매체명, 제목, 날짜, 링크

검증을 통과한 경우 반드시 아래 4개 영역을 순서대로 출력한다.

# 1. 게시용 본문
<!-- 게시용 본문 시작 -->
- 이 영역에는 WordPress에 바로 복사·붙여넣기 할 완성 글만 넣는다.
- H1 제목 다음 도입부에서 “다음 검색 질문”의 답을 먼저 제시한다.
- H2·H3, 필요한 표·목록·체크리스트, 핵심 요약, FAQ 3~5개, 마지막 “## 출처 및 참고자료”를 포함한다.
- 단순 뉴스 요약으로 끝내지 않고 비교표·타임라인·대상별 조건·행동 체크리스트 중 주제에 맞는 복제하기 어려운 요소를 최소 1개 포함한다.
- 중요한 날짜·수치·정책·사양은 최신 공식 자료에 맞춘다.
- 실제 기사 표현을 장문 인용하거나 재조합하지 않는다.
- AI가 쓴 티가 나는 상투적 도입, 과장, 같은 결론 반복, 불필요한 “중요합니다” 반복을 제거한다.
- “## 출처 및 참고자료”에는 본문에서 실제 사용한 핵심 출처 3~8개만 넣고 공식·1차 출처를 먼저 배치한다.
<!-- 게시용 본문 끝 -->

# 2. 게시 전 확인 자료
- **검증 기준일:** YYYY-MM-DD
- **뉴스 문맥 확인:** 정확한 사건·대상·발표일·적용일·현재 상태
- **최종 롱테일 수요 검증:** 대표 검색어, 수요 신호 종류, 신뢰도, 월간 검색량 확인 가능 여부
- **기존 글 중복 검토:** 신규 글/업데이트/통합/보강 판단
- **검색 결과 클릭 기회:** 독립 콘텐츠가 클릭받을 이유
- **잔여 수요와 발행 적시성:** 현재 관심 단계와 예상 잔여 기간
- **AdSense 정책 위험:** 없음 / 주의와 조건
- **정보 유효 기준일과 업데이트 조건:** 재검토 트리거
- **주제 위험 등급:** 일반 / 고위험
- **적용한 검증 기준:** 독립 출처 수와 공식·1차 출처 수
- **출처 충돌 검토:** 충돌 유무와 해결 근거
- **차별화 자산 확인:** 실제 본문에 넣은 표·타임라인·체크리스트 등
- **문체 검수 결과:** 제거한 AI식 상투어·반복·과장
- **핵심 주장 검증표:** 주장 | 근거 출처 | 공식·1차 여부 | 자료 날짜 | 다른 출처와 일치 여부
- **출처 목록:** 기관·매체명, 자료 제목, 발표일 또는 게시일, 확인일, 링크

# 3. 대표 이미지 생성 프롬프트
아래 형식의 별도 text 코드 블록으로 작성한다.
[대표 이미지 생성 프롬프트]
주제: 선택한 글의 핵심 내용을 한 장면으로 명확하게 표현
용도: 워드프레스 대표 이미지
화면 비율: 1.91:1, 권장 크기 1200×630px
스타일: 글의 성격에 맞는 사실적 편집 사진 또는 고품질 에디토리얼 일러스트
구도와 주요 요소: 실제 생성 도구가 이해할 수 있도록 인물·사물·배경·시점·조명을 구체적으로 작성
주의사항: 이미지 안에 제목, 한글, 영문 문구, 숫자, 로고, 워터마크를 넣지 않기. 실제 기관의 공식 이미지처럼 오인하게 만들지 않기. 인물·제품·장소를 사실과 다르게 왜곡하지 않기.
대체 텍스트: 포커스 키워드를 자연스럽게 포함한 설명형 문장

# 4. Rank Math SEO 패키지
각 항목은 반드시 아래 순서의 H2 소제목과 개별 text 코드 블록으로 분리한다. 여러 항목을 하나의 코드 블록에 합치지 않는다.

## 포커스 키워드
최종 롱테일 수요 검증을 통과한 대표 핵심 검색어 1개

## SEO title
포커스 키워드를 앞부분에 자연스럽게 포함하고 제목 끝에는 반드시 “ - 3분 전”을 한 번만 붙인다.

## 영문 퍼머링크
소문자 영문과 하이픈만 사용한 짧은 슬러그

## SEO description
포커스 키워드를 자연스럽게 1회 포함한 120~160자 안팎의 설명

## 글 태그
서로 중복되지 않는 관련 태그 5~10개를 쉼표로 구분

## 카테고리명
“IT·AI”, “경제·재테크·투자”, “생활·실용정보”, “취업·자격증·직무” 중 가장 적합한 카테고리 1개만 정확히 출력한다. 어느 카테고리에도 자연스럽게 해당하지 않으면 “없음”으로 출력한다.`;

function formatNumber(value: number | null): string {
  return value === null ? "확인 실패" : value.toLocaleString("ko-KR");
}

function formatPercent(value: number | null): string {
  if (value === null) return "확인 불가";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatCategoryPolicy(selection: CategorySelection): string {
  if (selection === "all") {
    return [
      "분석 범위: 아래 4개 카테고리 전체",
      ...BLOG_CATEGORIES.map((category) => `- ${category.label}: ${category.description}`),
      "최종 후보와 완성 글은 반드시 위 카테고리 중 자연스럽게 연결되는 1개를 선택할 것",
    ].join("\n");
  }

  const category = getBlogCategory(selection);
  return [
    `선택 카테고리: ${category.label}`,
    `범위: ${category.description}`,
    "최종 후보는 이 대분류와 직접 또는 자연스럽게 연결되는 주제만 남길 것",
  ].join("\n");
}

function formatAutocomplete(item: NewsOpportunity): string {
  if (item.autocomplete.status === "error") return "수집 실패";
  if (item.autocomplete.suggestions.length === 0) return "자동완성 결과 없음";
  return item.autocomplete.suggestions.join(" | ");
}

function formatOpportunity(item: NewsOpportunity): string {
  const articleLines = item.articles
    .slice(0, 6)
    .map(
      (article, index) =>
        `  ${index + 1}. ${article.title} | ${article.publisher} | ${article.publishedAt} | ${article.originalUrl}`,
    )
    .join("\n");

  return [
    `## 후보 ${item.rank}. ${item.representativeTitle}`,
    `- 예비 AI 추천 점수: ${item.preliminaryAiScore}/100`,
    `- 예상 경쟁 위험: ${item.competition.riskLevel} (${item.competition.riskScore}/100)`,
    `- 대표 핵심 롱테일 사전 힌트: ${item.longtailHint}`,
    `- 카테고리: ${item.categoryLabel}`,
    `- 후보 출처: 뉴스 조기 신호`,
    `- 뉴스 헤드라인 핵심 키워드: ${item.autocomplete.query}`,
    `- NAVER 자동완성: ${formatAutocomplete(item)}`,
    `- 사전 추출 주제: ${item.topic}`,
    `- 검색어 트렌드 확인용 키워드: ${item.searchKeyword}`,
    `- 다음 검색 질문: ${item.secondQuestion}`,
    `- 점수 세부: 뉴스속도 ${item.scoreBreakdown.newsVelocity}/20 | 검색관심 ${item.scoreBreakdown.searchInterest}/20 | 카테고리적합 ${item.scoreBreakdown.categoryFit}/15 | 후속질문 ${item.scoreBreakdown.secondQuestionClarity}/20 | 검증용이성 ${item.scoreBreakdown.verificationEase}/10 | 콘텐츠공백 ${item.scoreBreakdown.contentGap}/10 | 타이밍 ${item.scoreBreakdown.timing}/5`,
    `- Naver 블로그 검색 결과량: ${formatNumber(item.competition.blogResultTotal)}`,
    `- 상위 10개 중 유사 제목 수: ${formatNumber(item.competition.similarTopResultCount)}`,
    `- 뉴스 확산: ${item.newsVelocityLabel} | 전체 ${item.articleCount}건 | 최근 1시간 ${item.last1HourCount}건 | 최근 3시간 ${item.last3HourCount}건 | 독립 도메인 ${item.independentPublisherCount}곳`,
    `- Naver 검색 추세: ${item.trend.status} | 최근 평균 대비 변화 ${formatPercent(item.trend.momentumPercent)} | 최신 상대지수 ${item.trend.latestRatio ?? "-"}`,
    `- 수집 시드: ${item.matchedSeeds.join(", ")}`,
    `- 사전 판정 근거: ${item.reasons.join(" / ")}`,
    `- 참고 뉴스:`,
    articleLines || "  - 없음",
  ].join("\n");
}

export function buildNewsResearchPackage(input: {
  feed: NewsResearchResponse;
  prompt: string;
  existingContentInventory: string;
}): string {
  const { feed } = input;
  const existing = input.existingContentInventory.trim();
  return [
    input.prompt.trim() || DEFAULT_NEWS_RESEARCH_PROMPT,
    "",
    "---",
    "",
    "# 분석 대상 카테고리",
    formatCategoryPolicy(feed.summary.categorySelection),
    "",
    "# 데이터 품질",
    `- 수집 시각: ${feed.collectedAt}`,
    `- NAVER API 모드: ${feed.summary.apiMode === "hub" ? "API HUB" : "기존 Developer API fallback"}`,
    `- 뉴스 검색 시드: ${feed.summary.successfulSeedCount}/${feed.summary.requestedSeedCount} 성공, ${feed.summary.failedSeedCount} 실패`,
    `- 원본 뉴스 응답: ${feed.summary.rawArticleCount}건`,
    `- 최근 ${feed.summary.windowHours}시간 유효 뉴스: ${feed.summary.recentArticleCount}건`,
    `- 사건 군집: ${feed.summary.clusterCount}개`,
    `- Search Trend 검증 성공 후보: ${feed.summary.trendValidatedCount}/${feed.opportunities.length}`,
    `- Naver 블로그 경쟁 사전검증 성공 후보: ${feed.summary.competitionValidatedCount}/${feed.opportunities.length}`,
    `- Naver 자동완성 확보 후보: ${feed.summary.autocompleteValidatedCount}/${feed.opportunities.length}`,
    "- 주의: 뉴스 군집·롱테일·예비 점수·경쟁 위험·자동완성은 코드 기반 사전 압축 신호이며 최종 사실·SEO 판단은 반드시 최신 웹 검색으로 다시 검증할 것",
    feed.warnings.length > 0 ? `- 수집 경고: ${feed.warnings.join(" / ")}` : "- 수집 경고: 없음",
    "",
    "# 기존 발행 콘텐츠",
    existing || "제공되지 않음. 기존 글 중복 검사를 완료했다고 주장하지 말 것.",
    "",
    `# 사전 후보 ${feed.opportunities.length}개`,
    feed.opportunities.map(formatOpportunity).join("\n\n"),
  ].join("\n");
}
