export type BlogCategoryId = "it-ai" | "finance" | "life" | "career";

export type BlogCategory = {
  id: BlogCategoryId;
  label: string;
  description: string;
  seedKeywords: string[];
  intentKeywords: string[];
};

export type TemporaryResearchGroup = {
  id: `temp-${string}`;
  label: string;
  description: string;
  seedKeywords: string[];
  fallbackCategoryId: BlogCategoryId;
};

export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    id: "it-ai",
    label: "IT·AI",
    description: "AI, IT 서비스, 디지털 정책, 보안, 반도체, 기기·플랫폼 변화",
    seedKeywords: [
      "인공지능",
      "AI",
      "챗GPT",
      "네이버 AI",
      "카카오 AI",
      "반도체",
      "개인정보",
      "사이버 보안",
      "스마트폰",
      "빅테크",
    ],
    intentKeywords: [
      "출시",
      "업데이트",
      "변경",
      "기능",
      "가격",
      "지원",
      "보안",
      "개인정보",
      "규제",
      "오류",
    ],
  },
  {
    id: "finance",
    label: "경제·재테크·투자",
    description: "금리, 환율, 증시, 세금, 대출, 청약, 연금, 투자 제도 변화",
    seedKeywords: [
      "금리",
      "환율",
      "코스피",
      "미국 증시",
      "세금",
      "대출",
      "청약",
      "ETF",
      "연금",
      "부동산 정책",
    ],
    intentKeywords: [
      "인상",
      "인하",
      "세금",
      "대출",
      "금리",
      "신청",
      "조건",
      "한도",
      "공시",
      "배당",
    ],
  },
  {
    id: "life",
    label: "생활·실용정보",
    description: "지원금, 요금, 교통, 주거, 소비자 제도, 공공서비스 등 생활 변화",
    seedKeywords: [
      "지원금",
      "생활 정책",
      "교통",
      "통신비",
      "전기요금",
      "건강보험",
      "소비자",
      "주거 지원",
      "교육비",
      "공공서비스",
    ],
    intentKeywords: [
      "신청",
      "대상",
      "조건",
      "변경",
      "시행",
      "요금",
      "지원",
      "환급",
      "기간",
      "방법",
    ],
  },
  {
    id: "career",
    label: "취업·자격증·직무",
    description: "채용, 공무원, 시험, 자격증, 취업지원, 고용 제도와 직무 변화",
    seedKeywords: [
      "채용",
      "공무원 시험",
      "자격증",
      "시험 일정",
      "취업",
      "고용",
      "인턴",
      "청년 일자리",
      "국가자격시험",
      "채용 공고",
    ],
    intentKeywords: [
      "채용",
      "모집",
      "시험",
      "합격",
      "발표",
      "일정",
      "응시",
      "자격",
      "접수",
      "면접",
    ],
  },
];

// 기존 4개 WordPress 카테고리 밖에서도 검색 기회가 큰 주제를 놓치지 않기 위한
// 보조 탐색 그룹입니다. 실제 후보가 품질 게이트를 통과한 경우에만 UI에 나타납니다.
export const TEMPORARY_RESEARCH_GROUPS: TemporaryResearchGroup[] = [
  {
    id: "temp-health",
    label: "건강·의료",
    description: "건강보험 급여, 의약품·치료제 허가, 의료 제도처럼 공식 확인이 가능한 실용 정보",
    seedKeywords: ["건강보험 급여", "의약품 허가", "신약 출시"],
    fallbackCategoryId: "life",
  },
  {
    id: "temp-education",
    label: "교육·입시",
    description: "대학 입시, 장학금, 학과 신설, 교육 제도처럼 일정·조건 검색이 발생하기 쉬운 주제",
    seedKeywords: ["대학 입시", "장학금", "학과 신설"],
    fallbackCategoryId: "career",
  },
  {
    id: "temp-mobility",
    label: "자동차·모빌리티",
    description: "신차·전기차, 충전·보조금, 자동차 제도처럼 가격·조건·출시 검색으로 이어질 수 있는 주제",
    seedKeywords: ["신차 출시", "전기차 보조금", "자동차 정책"],
    fallbackCategoryId: "it-ai",
  },
  {
    id: "temp-travel",
    label: "여행·관광",
    description: "항공·공항, 비자, 여행 제도처럼 일정·비용·이용 조건을 확인하려는 검색이 생기는 주제",
    seedKeywords: ["항공 노선", "여행 정책", "비자 변경"],
    fallbackCategoryId: "life",
  },
];

export const BLOG_CATEGORY_IDS = new Set<BlogCategoryId>(
  BLOG_CATEGORIES.map((category) => category.id),
);

export function getBlogCategory(id: BlogCategoryId): BlogCategory {
  return BLOG_CATEGORIES.find((category) => category.id === id) ?? BLOG_CATEGORIES[0];
}
