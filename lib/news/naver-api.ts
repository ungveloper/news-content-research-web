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

export async function getNaverAutocompleteSuggestions(
  query: string,
): Promise<string[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const url = new URL("https://ac.search.naver.com/nx/ac");
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("con", "1");
  url.searchParams.set("frm", "nx");
  url.searchParams.set("ans", "2");
  url.searchParams.set("r_format", "json");
  url.searchParams.set("r_enc", "UTF-8");
  url.searchParams.set("r_unicode", "0");
  url.searchParams.set("t_koreng", "1");
  url.searchParams.set("run", "2");
  url.searchParams.set("rev", "4");
  url.searchParams.set("q_enc", "UTF-8");
  url.searchParams.set("st", "100");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/plain,*/*",
        Referer: "https://search.naver.com/",
      },
    });

    if (!response.ok) {
      throw new Error(`NAVER 자동완성 요청 실패 (${response.status})`);
    }

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object" || !("items" in payload)) return [];

    const groups = (payload as { items?: unknown }).items;
    if (!Array.isArray(groups)) return [];

    const suggestions: string[] = [];
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      for (const entry of group) {
        if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
        const value = entry[0].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (value && !suggestions.includes(value)) suggestions.push(value);
      }
    }

    return suggestions;
  } finally {
    clearTimeout(timeout);
  }
}
