"use client";

import { useEffect, useMemo, useState } from "react";

import { BLOG_CATEGORIES } from "@/lib/categories";
import {
  buildNewsResearchPackage,
  DEFAULT_NEWS_RESEARCH_PROMPT,
} from "@/lib/research-package";
import type {
  NewsOpportunity,
  NewsResearchErrorResponse,
  NewsResearchResponse,
} from "@/lib/types";

const PROMPT_STORAGE_KEY = "news-content-research:prompt";
const PROMPT_STORAGE_VERSION_KEY = "news-content-research:prompt-version";
const DEFAULT_PROMPT_VERSION = "all-category-grouped-prompts-v7";
const EXISTING_CONTENT_STORAGE_KEY = "news-content-research:existing-content";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / 1440)}일 전`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "확인 불가";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

async function parseResponse(
  response: Response,
): Promise<NewsResearchResponse> {
  const payload = (await response.json().catch(() => null)) as
    | NewsResearchResponse
    | NewsResearchErrorResponse
    | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(
      payload && "message" in payload
        ? payload.message
        : "뉴스 기회 데이터를 불러오지 못했습니다.",
    );
  }
  return payload;
}

function ScoreBar({ item }: { item: NewsOpportunity }) {
  return (
    <div className="score-bar" aria-label={`예비 AI 추천 점수 ${item.preliminaryAiScore}점`}>
      <span style={{ width: `${item.preliminaryAiScore}%` }} />
    </div>
  );
}

export default function NewsResearchWorkbench() {
  const [feed, setFeed] = useState<NewsResearchResponse | null>(null);
  const [windowHours, setWindowHours] = useState(1 / 6);
  const [maxResults, setMaxResults] = useState(20);
  const [customSeedText, setCustomSeedText] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_NEWS_RESEARCH_PROMPT);
  const [existingContentInventory, setExistingContentInventory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyingPackage, setCopyingPackage] = useState(false);
  const [copyingGroupId, setCopyingGroupId] = useState<string | null>(null);
  const [copyProgress, setCopyProgress] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const savedPrompt = window.localStorage.getItem(PROMPT_STORAGE_KEY);
    const savedPromptVersion = window.localStorage.getItem(
      PROMPT_STORAGE_VERSION_KEY,
    );
    const savedExisting = window.localStorage.getItem(EXISTING_CONTENT_STORAGE_KEY);

    const frameId = window.requestAnimationFrame(() => {
      if (savedPrompt && savedPromptVersion === DEFAULT_PROMPT_VERSION) {
        setPrompt(savedPrompt);
      }
      if (savedExisting) setExistingContentInventory(savedExisting);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const researchPackage = useMemo(() => {
    if (!feed) return "";
    return buildNewsResearchPackage({
      feed,
      prompt,
      existingContentInventory,
    });
  }, [existingContentInventory, feed, prompt]);

  async function collect() {
    if (loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    setFeed(null);
    setExpandedId(null);

    const customSeeds = customSeedText
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 8);

    try {
      const response = await fetch("/api/news/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySelection: "all",
          windowHours,
          maxResults,
          customSeeds,
        }),
      });
      const result = await parseResponse(response);
      setFeed(result);
      await copyResearchPackage(result, true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "뉴스 기회 데이터를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyText(value: string, successMessage: string) {
    if (!value.trim()) {
      setError("복사할 데이터가 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setNotice(successMessage);
    } catch {
      setError("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  async function waitForPaint() {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  async function copyResearchPackage(
    targetFeed: NewsResearchResponse | null = feed,
    automatic = false,
    groupId: string | null = null,
  ) {
    if (!targetFeed || copyingPackage) return;

    const group = groupId
      ? targetFeed.groups.find((entry) => entry.id === groupId)
      : null;
    const opportunityCount = group
      ? group.opportunityIds.length
      : targetFeed.opportunities.length;
    const scopeLabel = group
      ? `${group.temporary ? "임시 확장 추천 · " : ""}${group.label}`
      : "전체 통합";

    setCopyingPackage(true);
    setCopyingGroupId(groupId ?? "all");
    setCopyProgress(25);
    setCopyStatus(`1/4 · ${scopeLabel} 후보 ${opportunityCount}개 확인 중`);
    setError("");
    setNotice("");

    try {
      await waitForPaint();

      if (opportunityCount === 0) {
        throw new Error("복사할 뉴스 후보가 없습니다.");
      }

      setCopyProgress(50);
      setCopyStatus(`2/4 · ${scopeLabel} ChatGPT 심층 검증 프롬프트 생성 중`);
      await waitForPaint();

      const packageText = buildNewsResearchPackage({
        feed: targetFeed,
        prompt,
        existingContentInventory,
        groupId,
      });

      if (!packageText.trim()) {
        throw new Error("ChatGPT용 전체 패키지를 생성하지 못했습니다.");
      }

      setCopyProgress(75);
      setCopyStatus(automatic
        ? "3/4 · 전체 수집 완료 · 클립보드 자동 복사 중"
        : `3/4 · ${scopeLabel} 프롬프트를 클립보드에 복사 중`);
      await waitForPaint();

      await navigator.clipboard.writeText(packageText);

      setCopyProgress(100);
      setCopyStatus(
        `4/4 · ${scopeLabel} 복사 완료 · ${packageText.length.toLocaleString("ko-KR")}자`,
      );
      setNotice(
        automatic
          ? `${targetFeed.summary.recentArticleCount.toLocaleString("ko-KR")}건의 탐지 범위 뉴스를 ${targetFeed.summary.clusterCount.toLocaleString("ko-KR")}개 사건 묶음으로 압축·교차 검증했고, 전체 통합 ChatGPT 프롬프트까지 자동 복사했습니다. 이제 아래 카테고리 버튼을 누르면 해당 후보만 즉시 다시 복사할 수 있습니다.`
          : `${scopeLabel} 후보 ${opportunityCount}개가 포함된 ChatGPT 프롬프트를 복사했습니다.`,
      );
    } catch (caught) {
      const knownMessage =
        caught instanceof Error &&
        (caught.message === "복사할 뉴스 후보가 없습니다." ||
          caught.message === "ChatGPT용 전체 패키지를 생성하지 못했습니다.")
          ? caught.message
          : null;

      if (automatic) {
        setNotice(
          `${targetFeed.summary.recentArticleCount.toLocaleString("ko-KR")}건의 뉴스 수집·검증은 완료됐습니다. 다만 브라우저 보안 정책으로 자동 클립보드 복사가 허용되지 않았습니다. 아래 “전체 통합” 버튼을 한 번 눌러 주세요.`,
        );
        if (knownMessage) setError(knownMessage);
      } else {
        setError(knownMessage ?? "클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
      }
      setCopyingPackage(false);
      setCopyingGroupId(null);
      setCopyProgress(0);
      setCopyStatus("");
      return;
    } finally {
      window.setTimeout(() => {
        setCopyingPackage(false);
        setCopyingGroupId(null);
        setCopyProgress(0);
        setCopyStatus("");
      }, 1400);
    }
  }

  function saveSettings() {
    window.localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
    window.localStorage.setItem(
      PROMPT_STORAGE_VERSION_KEY,
      DEFAULT_PROMPT_VERSION,
    );
    window.localStorage.setItem(
      EXISTING_CONTENT_STORAGE_KEY,
      existingContentInventory,
    );
    setNotice("프롬프트와 기존 글 목록을 현재 브라우저에 저장했습니다.");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero__eyebrow">NEWS CONTENT RESEARCH</div>
        <h1>뉴스가 검색어가 되기 전에,<br />다음 질문을 먼저 찾습니다.</h1>
        <p>
          NAVER 뉴스 확산 속도, Search Trend, 자동완성, 블로그 경쟁 신호를 여러 번 교차 확인해
          네 개의 WordPress 카테고리에서 빠르게 발행할 만한 후속 검색 주제를 압축하고, ChatGPT 단계에서 Google SEO·Naver SEO·AdSense 콘텐츠 가치를 각각 다시 검증합니다.
        </p>
        <div className="hero__steps" aria-label="분석 흐름">
          <span><b>1</b> 뉴스 수집</span>
          <span><b>2</b> 사건 군집화</span>
          <span><b>3</b> 검색·경쟁 검증</span>
          <span><b>4</b> ChatGPT 심층 검증</span>
        </div>
      </section>

      <section className="panel controls-panel">
        <div className="section-heading">
          <div>
            <span className="step">STEP 1</span>
            <h2>뉴스 기회 탐색 조건</h2>
            <p>버튼 한 번으로 기본 4개 카테고리를 모두 조회하고, 별도 확장 시드에서도 글쓰기 기회가 강한 주제를 추가 탐색합니다.</p>
          </div>
        </div>

        <div className="category-grid" aria-label="자동 탐색 대상 카테고리">
          {BLOG_CATEGORIES.map((category) => (
            <div className="category-card category-card--static" key={category.id}>
              <div className="category-card__label">
                <strong>{category.label}</strong>
                <span className="auto-search-badge">자동 조회</span>
              </div>
              <span>{category.description}</span>
            </div>
          ))}
        </div>

        <div className="control-grid">
          <label>
            <span>최근 뉴스 범위</span>
            <select value={windowHours} onChange={(event) => setWindowHours(Number(event.target.value))}>
              <option value={1 / 6}>최근 10분 (기본 · 초고속 탐지)</option>
              <option value={0.5}>최근 30분</option>
              <option value={1}>최근 1시간</option>
              <option value={3}>최근 3시간</option>
              <option value={6}>최근 6시간</option>
              <option value={12}>최근 12시간</option>
              <option value={24}>최근 24시간</option>
              <option value={48}>최근 48시간</option>
            </select>
          </label>
          <label>
            <span>기본 4개 표시 후보 기준</span>
            <select value={maxResults} onChange={(event) => setMaxResults(Number(event.target.value))}>
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={30}>30개</option>
            </select>
          </label>
          <label className="seed-input">
            <span>추가 시드 키워드 <em>선택 · 최대 8개</em></span>
            <input
              value={customSeedText}
              onChange={(event) => setCustomSeedText(event.target.value)}
              placeholder="예: 주민세, 사관학교, 아이폰"
            />
          </label>
          <button className="button button--primary collect-button" disabled={loading} onClick={() => void collect()} type="button">
            {loading ? "뉴스 검증 중…" : "뉴스 기회 탐색"}
          </button>
        </div>

        <p className="filter-help">
          최근 뉴스 범위는 “새 신호 탐지 범위”입니다. 10분을 선택해도 확산 점수는 최근 3시간 맥락을 함께 확인합니다. 기본 4개 카테고리는 항상 모두 조회하며, 확장 추천은 더 엄격한 검색 기회 게이트를 통과한 경우에만 추가됩니다. 수집이 끝나면 전체 통합 ChatGPT 프롬프트 자동 복사를 시도합니다.
        </p>
        {error ? <div className="notice notice--error">{error}</div> : null}
        {notice ? <div className="notice notice--success">{notice}</div> : null}
      </section>

      {loading ? (
        <section className="panel loading-panel">
          <div className="loading-spinner" />
          <strong>기본 4개 카테고리와 확장 추천 신호를 한 번에 수집하고 있습니다.</strong>
          <span>뉴스 검색 → 사건 군집화 → Search Trend → Naver 자동완성 → 블로그 경쟁 → 검색 기회 게이트 순서로 진행됩니다.</span>
        </section>
      ) : null}

      {feed ? (
        <>
          <section className="panel summary-panel">
            <div className="section-heading">
              <div>
                <span className="step">STEP 2</span>
                <h2>수집·검증 요약</h2>
                <p>{formatDateTime(feed.collectedAt)} 기준 · {feed.summary.apiMode === "hub" ? "NAVER API HUB" : "기존 API fallback"}</p>
              </div>
            </div>
            <div className="summary-grid">
              <div><span>시드 성공</span><strong>{feed.summary.successfulSeedCount}/{feed.summary.requestedSeedCount}</strong></div>
              <div><span>최근 뉴스</span><strong>{feed.summary.recentArticleCount.toLocaleString("ko-KR")}</strong></div>
              <div><span>사건 묶음</span><strong>{feed.summary.clusterCount.toLocaleString("ko-KR")}</strong></div>
              <div><span>Trend 검증</span><strong>{feed.summary.trendValidatedCount}/{feed.opportunities.length}</strong></div>
              <div><span>경쟁 검증</span><strong>{feed.summary.competitionValidatedCount}/{feed.opportunities.length}</strong></div>
              <div><span>자동완성</span><strong>{feed.summary.autocompleteValidatedCount}/{feed.opportunities.length}</strong></div>
            </div>
            <div className="opportunity-gate-summary">
              <strong>검색 기회 게이트</strong>
              <span>{feed.summary.searchOpportunityEvaluatedCount}개 평가 · {feed.summary.searchOpportunityExcludedCount}개 제외 · 통과/주의 {feed.summary.searchOpportunityEvaluatedCount - feed.summary.searchOpportunityExcludedCount}개 중 상위 {feed.opportunities.length}개 표시</span>
            </div>
            {feed.warnings.length > 0 ? (
              <details className="warning-details">
                <summary>수집 경고 {feed.warnings.length}개</summary>
                <ul>{feed.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </details>
            ) : null}
          </section>

          <section className="panel opportunities-panel">
            <div className="section-heading">
              <div>
                <span className="step">STEP 3</span>
                <h2>카테고리별 프롬프트와 뉴스 검색 기회 후보</h2>
                <p>수집은 모든 기본 카테고리에 대해 한 번만 수행합니다. 카테고리별 복사 버튼으로 후보를 나눠 ChatGPT Pro에 전달하고, 확장 추천이 있으면 임시 그룹도 함께 제공합니다.</p>
              </div>
            </div>

            <div className="prompt-group-section">
              <div className="prompt-group-section__heading">
                <div>
                  <strong>카테고리별 ChatGPT 프롬프트</strong>
                  <span>수집은 한 번만 수행합니다. 이후 원하는 카테고리 버튼을 누르면 해당 후보만 담은 프롬프트가 즉시 복사됩니다.</span>
                </div>
              </div>

              <div className="prompt-group-grid">
                <button
                  type="button"
                  className="prompt-group-card prompt-group-card--all"
                  disabled={feed.opportunities.length === 0 || copyingPackage}
                  onClick={() => void copyResearchPackage(feed, false, null)}
                >
                  <span className="prompt-group-card__meta">전체 통합</span>
                  <strong>모든 카테고리 한 번에 복사</strong>
                  <small>기본 4개 + 확장 추천 · 후보 {feed.opportunities.length}개</small>
                  <b>
                    {copyingPackage && copyingGroupId === "all" ? (
                      <>
                        <span className="button-spinner" aria-hidden="true" />
                        {copyProgress === 100 ? "복사 완료" : "복사 중…"}
                      </>
                    ) : "프롬프트 복사"}
                  </b>
                </button>

                {feed.groups.map((group) => (
                  <button
                    type="button"
                    className={`prompt-group-card${group.temporary ? " prompt-group-card--temporary" : ""}`}
                    key={group.id}
                    disabled={group.opportunityIds.length === 0 || copyingPackage}
                    onClick={() => void copyResearchPackage(feed, false, group.id)}
                  >
                    <span className="prompt-group-card__meta">
                      {group.temporary ? "임시 확장 추천" : "기본 카테고리"}
                    </span>
                    <strong>{group.label}</strong>
                    <small>후보 {group.opportunityIds.length}개 · {group.description}</small>
                    <b>
                      {copyingPackage && copyingGroupId === group.id ? (
                        <>
                          <span className="button-spinner" aria-hidden="true" />
                          {copyProgress === 100 ? "복사 완료" : "복사 중…"}
                        </>
                      ) : group.opportunityIds.length > 0 ? "프롬프트 복사" : "현재 후보 없음"}
                    </b>
                  </button>
                ))}
              </div>

              <p className="prompt-group-help">
                임시 확장 추천은 기존 4개 카테고리 밖에서 검색 기회 점수·예비 AI 추천 점수·경쟁 위험 게이트를 더 엄격하게 통과한 경우에만 나타납니다. ChatGPT가 최종적으로 기존 카테고리 매핑 또는 신규 카테고리 제안 여부를 다시 검증합니다.
              </p>
            </div>

            {copyingPackage || copyProgress > 0 ? (
              <div className="copy-progress-card" role="status" aria-live="polite">
                <div className="copy-progress-card__text">
                  <span>{copyStatus}</span>
                  <strong>{copyProgress}%</strong>
                </div>
                <div
                  className="copy-progress-track"
                  role="progressbar"
                  aria-label="ChatGPT용 전체 복사 단계 진행률"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={copyProgress}
                >
                  <span style={{ width: `${copyProgress}%` }} />
                </div>
                <small>클립보드 API는 바이트 단위 전송률을 제공하지 않아 실제 작업 단계 4개를 기준으로 표시합니다.</small>
              </div>
            ) : null}

            <div className="opportunity-list">
              {feed.opportunities.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <article className="opportunity-card" key={item.id}>
                    <div className="opportunity-card__top">
                      <div className="rank-badge">{item.rank}</div>
                      <div className="opportunity-title">
                        <div className="badge-row">
                          <span className={`badge badge--category${item.isTemporaryCategory ? " badge--temporary-category" : ""}`}>{item.isTemporaryCategory ? `${item.researchGroupLabel} · 임시` : item.categoryLabel}</span>
                          <span className={`badge badge--velocity badge--${item.newsVelocityLabel}`}>{item.newsVelocityLabel}</span>
                          <span className={`badge risk risk--${item.competition.riskLevel.replace(" ", "-")}`}>경쟁 {item.competition.riskLevel}</span>
                          <span className={`badge opportunity opportunity--${item.searchOpportunity.level.replace(" ", "-")}`}>기회 {item.searchOpportunity.level}</span>
                        </div>
                        <h3>{item.representativeTitle}</h3>
                        <p>{item.secondQuestion}</p>
                      </div>
                      <div className="score-box">
                        <span>예비 AI 추천</span>
                        <strong>{item.preliminaryAiScore}<small>/100</small></strong>
                        <ScoreBar item={item} />
                      </div>
                    </div>

                    <div className="signal-grid">
                      <div>
                        <span>뉴스 확산</span>
                        <strong>1h {item.last1HourCount} · 3h {item.last3HourCount}</strong>
                        <small>{item.articleCount}건 · 독립 {item.independentPublisherCount}곳 · {formatAge(item.ageMinutes)}</small>
                      </div>
                      <div>
                        <span>Naver 검색 추세</span>
                        <strong>{formatPercent(item.trend.momentumPercent)}</strong>
                        <small>{item.trend.status === "ok" ? "최근 3일 평균 vs 이전 기준 구간" : "검색 추세 확인 제한"}</small>
                      </div>
                      <div>
                        <span>예상 경쟁 위험</span>
                        <strong>{item.competition.riskScore}/100</strong>
                        <small>블로그 결과 {item.competition.blogResultTotal?.toLocaleString("ko-KR") ?? "-"}건</small>
                      </div>
                      <div className="search-opportunity-signal">
                        <span>검색 기회 점수</span>
                        <strong>{item.searchOpportunity.score}/100 · {item.searchOpportunity.level}</strong>
                        <small>게이트 {item.searchOpportunity.gate} · 수요·경쟁여지·의도·공백 종합</small>
                      </div>
                      <div>
                        <span>대표 롱테일 힌트</span>
                        <strong className="longtail">{item.longtailHint}</strong>
                        <small>최종 표현은 ChatGPT가 SERP 재검증</small>
                      </div>
                    </div>

                    <div className="card-actions">
                      <a href={item.articles[0]?.url} target="_blank" rel="noreferrer">대표 뉴스 열기 ↗</a>
                      <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)}>
                        {expanded ? "근거 접기" : "판정 근거·기사 보기"}
                      </button>
                    </div>

                    {expanded ? (
                      <div className="opportunity-details">
                        <div>
                          <h4>점수 세부</h4>
                          <ul className="breakdown-list">
                            <li>뉴스 확산 속도 <b>{item.scoreBreakdown.newsVelocity}/20</b></li>
                            <li>검색 관심 변화 <b>{item.scoreBreakdown.searchInterest}/20</b></li>
                            <li>카테고리 적합성 <b>{item.scoreBreakdown.categoryFit}/15</b></li>
                            <li>후속 질문 명확성 <b>{item.scoreBreakdown.secondQuestionClarity}/20</b></li>
                            <li>검증 용이성 <b>{item.scoreBreakdown.verificationEase}/10</b></li>
                            <li>콘텐츠 공백 <b>{item.scoreBreakdown.contentGap}/10</b></li>
                            <li>발행 타이밍 <b>{item.scoreBreakdown.timing}/5</b></li>
                          </ul>
                        </div>
                        <div>
                          <h4>검색 기회 세부</h4>
                          <ul className="breakdown-list">
                            <li>수요 가능성 <b>{item.searchOpportunity.breakdown.demandPotential}/25</b></li>
                            <li>경쟁 진입 여지 <b>{item.searchOpportunity.breakdown.competitionHeadroom}/20</b></li>
                            <li>검색 의도 구체성 <b>{item.searchOpportunity.breakdown.intentSpecificity}/20</b></li>
                            <li>콘텐츠 공백 가능성 <b>{item.searchOpportunity.breakdown.contentGapPotential}/15</b></li>
                            <li>발행 타이밍 <b>{item.searchOpportunity.breakdown.timingWindow}/10</b></li>
                            <li>증거 강도 <b>{item.searchOpportunity.breakdown.evidenceStrength}/10</b></li>
                          </ul>
                          <small className="opportunity-gate-note">게이트 {item.searchOpportunity.gate} · 낮은 경쟁만으로 높은 기회로 판정하지 않습니다.</small>
                        </div>
                        <div>
                          <h4>사전 판정 근거</h4>
                          <ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                        </div>
                        <div className="autocomplete-details">
                          <h4>Naver 자동완성</h4>
                          <p>헤드라인 사전 추출 핵심 키워드 <b>{item.autocomplete.query}</b></p>
                          {item.autocomplete.suggestions.length > 0 ? (
                            <div className="autocomplete-tags">
                              {item.autocomplete.suggestions.map((suggestion) => (
                                <span key={suggestion}>{suggestion}</span>
                              ))}
                            </div>
                          ) : (
                            <small>{item.autocomplete.status === "error" ? "자동완성 수집에 실패했습니다. 최종 검증에서 직접 확인합니다." : "현재 자동완성 결과가 없습니다."}</small>
                          )}
                        </div>
                        <div className="source-list">
                          <h4>같은 사건으로 묶인 기사</h4>
                          {item.articles.map((article) => (
                            <a key={`${article.originalUrl}-${article.publishedAt}`} href={article.originalUrl} target="_blank" rel="noreferrer">
                              <strong>{article.title}</strong>
                              <span>{article.publisher} · {formatDateTime(article.publishedAt)} · 시드 {article.matchedSeed}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {feed.opportunities.length === 0 ? <div className="empty-state">현재 조건에서 사전 후보를 찾지 못했습니다. 시간 범위를 넓히거나 추가 시드를 입력해 보세요.</div> : null}
          </section>

          <section className="panel prompt-panel">
            <div className="section-heading">
              <div>
                <span className="step">STEP 4</span>
                <h2>ChatGPT Pro 심층 검증 패키지</h2>
                <p>전체 후보와 사전 점수를 복사해 ChatGPT에서 Google SEO·Naver SEO·AdSense 콘텐츠 가치를 각각 검증합니다. 후보 번호 선택 후에는 기존 ai-trends-editor와 동일한 4개 영역으로 완성 글을 출력합니다.</p>
              </div>
            </div>

            <label className="editor-field">
              <span>기존 발행 콘텐츠 목록 <em>선택 입력</em></span>
              <textarea
                rows={5}
                value={existingContentInventory}
                onChange={(event) => setExistingContentInventory(event.target.value)}
                placeholder={"글 제목 | URL | 핵심 검색어 형식으로 한 줄씩 입력\n예: 서울교육청 9급 면접 일정 | https://example.com/post | 서울교육청 9급 면접"}
              />
              <small>입력하면 같은 검색 의도의 신규 글을 피하고 업데이트·통합·보강 여부를 판단하며, URL이 있는 관련 글은 본문 내부링크 후보로도 활용합니다.</small>
            </label>

            <label className="editor-field">
              <span>심층 검증·글 작성 프롬프트</span>
              <textarea rows={18} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>

            <div className="action-row">
              <button className="button button--secondary" type="button" onClick={saveSettings}>프롬프트·설정 저장</button>
              <button className="button button--secondary" type="button" disabled={feed.opportunities.length === 0} onClick={() => void copyText(JSON.stringify(feed.opportunities, null, 2), "후보 JSON을 복사했습니다.")}>후보 JSON 복사</button>
            </div>

            <details className="prompt-preview">
              <summary>복사될 전체 프롬프트 미리보기</summary>
              <pre>{researchPackage}</pre>
            </details>
          </section>
        </>
      ) : null}

      <footer className="footer-note">
        <p>뉴스 기사 수와 검색 추세는 탐색 신호입니다. 최종 게시 전에는 ChatGPT 심층 검증 단계에서 Google SEO·Naver SEO·독자 가치·내부링크·AdSense 정책 위험과 공식 출처를 다시 확인하도록 설계했습니다.</p>
      </footer>
    </main>
  );
}
