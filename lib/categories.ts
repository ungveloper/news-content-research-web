export type BlogCategoryId = "it-ai" | "finance" | "life" | "career";

export type BlogCategory = {
  id: BlogCategoryId;
  label: string;
  description: string;
  seedKeywords: string[];
  intentKeywords: string[];
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

export const BLOG_CATEGORY_IDS = new Set<BlogCategoryId>(
  BLOG_CATEGORIES.map((category) => category.id),
);

export function getBlogCategory(id: BlogCategoryId): BlogCategory {
  return BLOG_CATEGORIES.find((category) => category.id === id) ?? BLOG_CATEGORIES[0];
}
