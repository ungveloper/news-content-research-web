import {
  collectNewsOpportunities,
  parseCategorySelection,
} from "@/lib/news/news-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseCustomSeeds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};

  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }

  const categorySelection = parseCategorySelection(body.categorySelection);
  const windowHours =
    typeof body.windowHours === "number" && Number.isFinite(body.windowHours)
      ? body.windowHours
      : 3;
  const maxResults =
    typeof body.maxResults === "number" && Number.isFinite(body.maxResults)
      ? body.maxResults
      : 20;
  const customSeeds = parseCustomSeeds(body.customSeeds);

  try {
    const result = await collectNewsOpportunities({
      categorySelection,
      windowHours,
      customSeeds,
      maxResults,
    });
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("뉴스 기회 탐색 실패", error);
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "뉴스 기회 데이터를 수집하지 못했습니다.",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
