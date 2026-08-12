type ApiMode = "hub" | "legacy";

type NaverApiConfiguration = {
  mode: ApiMode;
  clientId: string;
  clientSecret: string;
};

export type NaverNewsItem = {
  title: string;
  originallink?: string;
  link: string;
  description: string;
  pubDate: string;
};

export type NaverSearchResponse<T> = {
  lastBuildDate?: string;
  total: number;
  start: number;
  display: number;
  items: T[];
};

type SearchTrendDataPoint = {
  period: string;
  ratio: number;
};

type SearchTrendResult = {
  title: string;
  keywords: string[];
  data: SearchTrendDataPoint[];
};

export type SearchTrendResponse = {
  startDate: string;
  endDate: string;
  timeUnit: "date" | "week" | "month";
  results: SearchTrendResult[];
};

function readConfiguration(): NaverApiConfiguration {
  const requestedMode = process.env.NAVER_API_MODE?.trim().toLowerCase();
  const hubClientId = process.env.NAVER_API_HUB_CLIENT_ID?.trim();
  const hubClientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET?.trim();
  const legacyClientId = process.env.NAVER_CLIENT_ID?.trim();
  const legacyClientSecret = process.env.NAVER_CLIENT_SECRET?.trim();

  if (requestedMode !== "legacy" && hubClientId && hubClientSecret) {
    return {
      mode: "hub",
      clientId: hubClientId,
      clientSecret: hubClientSecret,
    };
  }

  if (requestedMode !== "hub" && legacyClientId && legacyClientSecret) {
    return {
      mode: "legacy",
      clientId: legacyClientId,
      clientSecret: legacyClientSecret,
    };
  }

  throw new Error(
    "NAVER API 인증 정보가 없습니다. .env.local에 NAVER_API_HUB_CLIENT_ID와 NAVER_API_HUB_CLIENT_SECRET을 설정해 주세요.",
  );
}

function getHeaders(configuration: NaverApiConfiguration): HeadersInit {
  if (configuration.mode === "hub") {
    return {
      "X-NCP-APIGW-API-KEY-ID": configuration.clientId,
      "X-NCP-APIGW-API-KEY": configuration.clientSecret,
    };
  }

  return {
    "X-Naver-Client-Id": configuration.clientId,
    "X-Naver-Client-Secret": configuration.clientSecret,
  };
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const apiMessage =
      payload && typeof payload === "object" && "errorMessage" in payload
        ? String((payload as { errorMessage?: unknown }).errorMessage ?? "")
        : payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? "")
          : "";

    throw new Error(
      apiMessage || `NAVER API 요청에 실패했습니다. (${response.status})`,
    );
  }

  return payload as T;
}

export function getNaverApiMode(): ApiMode {
  return readConfiguration().mode;
}

export async function searchNaverNews(
  query: string,
  display = 30,
): Promise<NaverSearchResponse<NaverNewsItem>> {
  const configuration = readConfiguration();
  const baseUrl =
    configuration.mode === "hub"
      ? "https://naverapihub.apigw.ntruss.com/search/v1/news"
      : "https://openapi.naver.com/v1/search/news.json";
  const url = new URL(baseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.max(1, Math.min(display, 100))));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "date");
  if (configuration.mode === "hub") url.searchParams.set("format", "json");

  return fetchJson<NaverSearchResponse<NaverNewsItem>>(url.toString(), {
    method: "GET",
    headers: getHeaders(configuration),
  });
}

export async function searchNaverBlogs(
  query: string,
  display = 10,
): Promise<NaverSearchResponse<{ title: string; link: string; description: string }>> {
  const configuration = readConfiguration();
  const baseUrl =
    configuration.mode === "hub"
      ? "https://naverapihub.apigw.ntruss.com/search/v1/blog"
      : "https://openapi.naver.com/v1/search/blog.json";
  const url = new URL(baseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.max(1, Math.min(display, 100))));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "sim");
  if (configuration.mode === "hub") url.searchParams.set("format", "json");

  return fetchJson<NaverSearchResponse<{ title: string; link: string; description: string }>>(
    url.toString(),
    {
      method: "GET",
      headers: getHeaders(configuration),
    },
  );
}

export async function getNaverSearchTrends(input: {
  startDate: string;
  endDate: string;
  keywordGroups: Array<{ groupName: string; keywords: string[] }>;
}): Promise<SearchTrendResponse> {
  const configuration = readConfiguration();
  const url =
    configuration.mode === "hub"
      ? "https://naverapihub.apigw.ntruss.com/search-trend/v1/search"
      : "https://openapi.naver.com/v1/datalab/search";

  return fetchJson<SearchTrendResponse>(url, {
    method: "POST",
    headers: {
      ...getHeaders(configuration),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      timeUnit: "date",
      keywordGroups: input.keywordGroups,
    }),
  });
}
