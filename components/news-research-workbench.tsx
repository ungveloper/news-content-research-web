"use client";

import { useEffect, useMemo, useState } from "react";

import { BLOG_CATEGORIES } from "@/lib/categories";
import {
  buildNewsResearchPackage,
  DEFAULT_NEWS_RESEARCH_PROMPT,
} from "@/lib/research-package";
import type {
  CategorySelection,
  ManualAutocompleteCapturePlan,
  NewsOpportunity,
  NewsResearchErrorResponse,
  NewsResearchResponse,
} from "@/lib/types";

const PROMPT_STORAGE_KEY = "news-content-research:prompt";
const PROMPT_STORAGE_VERSION_KEY = "news-content-research:prompt-version";
const DEFAULT_PROMPT_VERSION = "google-naver-adsense-autocomplete-capture-v3";
const EXISTING_CONTENT_STORAGE_KEY = "news-content-research:existing-content";
const CATEGORY_STORAGE_KEY = "news-content-research:category";

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
  const [categorySelection, setCategorySelection] =
    useState<CategorySelection>("all");
  const [windowHours, setWindowHours] = useState(3);
  const [maxResults, setMaxResults] = useState(20);
  const [customSeedText, setCustomSeedText] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_NEWS_RESEARCH_PROMPT);
  const [existingContentInventory, setExistingContentInventory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyingPackage, setCopyingPackage] = useState(false);
  const [copyProgress, setCopyProgress] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [manualAutocompleteQueries, setManualAutocompleteQueries] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const savedPrompt = window.localStorage.getItem(PROMPT_STORAGE_KEY);
    const savedPromptVersion = window.localStorage.getItem(
      PROMPT_STORAGE_VERSION_KEY,
    );
    const savedExisting = window.localStorage.getItem(EXISTING_CONTENT_STORAGE_KEY);
    const savedCategory = window.localStorage.getItem(CATEGORY_STORAGE_KEY);

    const frameId = window.requestAnimationFrame(() => {
      if (savedPrompt && savedPromptVersion === DEFAULT_PROMPT_VERSION) {
        setPrompt(savedPrompt);
      }
      if (savedExisting) setExistingContentInventory(savedExisting);
      if (
        savedCategory === "all" ||
        BLOG_CATEGORIES.some((category) => category.id === savedCategory)
      ) {
        setCategorySelection(savedCategory as CategorySelection);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const autocompleteCapturePlans = useMemo<ManualAutocompleteCapturePlan[]>(() => {
    if (!feed) return [];

    return feed.opportunities.flatMap((item) => {
      if (!(item.id in manualAutocompleteQueries)) return [];
      const query = manualAutocompleteQueries[item.id].trim() || item.autocomplete.query;
      if (!query) return [];

      return [{
        opportunityId: item.id,
        rank: item.rank,
        title: item.representativeTitle,
        query,
      }];
    });
  }, [feed, manualAutocompleteQueries]);

  const researchPackage = useMemo(() => {
    if (!feed) return "";
    return buildNewsResearchPackage({
      feed,
      prompt,
      existingContentInventory,
      autocompleteCapturePlans,
    });
  }, [autocompleteCapturePlans, existingContentInventory, feed, prompt]);

  async function collect() {
    if (loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    setFeed(null);
    setExpandedId(null);
    setManualAutocompleteQueries({});

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
          categorySelection,
          windowHours,
          maxResults,
          customSeeds,
        }),
      });
      const result = await parseResponse(response);
      setFeed(result);
      setNotice(
        `${result.summary.recentArticleCount.toLocaleString("ko-KR")}건의 최근 뉴스를 ${result.summary.clusterCount.toLocaleString("ko-KR")}개 사건 묶음으로 압축한 뒤 Search Trend, Naver 자동완성, 블로그 경쟁 신호를 교차 확인했습니다.`,
      );
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

  async function copyResearchPackage() {
    if (!feed || copyingPackage) return;

    setCopyingPackage(true);
    setCopyProgress(25);
    setCopyStatus(`1/4 · 후보 ${feed.opportunities.length}개 · 캡처 ${autocompleteCapturePlans.length}개 확인 중`);
    setError("");
    setNotice("");

    try {
      await waitForPaint();

      if (feed.opportunities.length === 0) {
        throw new Error("복사할 뉴스 후보가 없습니다.");
      }

      setCopyProgress(50);
      setCopyStatus("2/4 · ChatGPT 심층 검증 프롬프트 생성 중");
      await waitForPaint();

      const packageText = buildNewsResearchPackage({
        feed,
        prompt,
        existingContentInventory,
        autocompleteCapturePlans,
      });

      if (!packageText.trim()) {
        throw new Error("ChatGPT용 전체 패키지를 생성하지 못했습니다.");
      }

      setCopyProgress(75);
      setCopyStatus("3/4 · 클립보드에 전체 패키지 복사 중");
      await waitForPaint();

      await navigator.clipboard.writeText(packageText);

      setCopyProgress(100);
      setCopyStatus(
        `4/4 · 복사 완료 · ${packageText.length.toLocaleString("ko-KR")}자`,
      );
      setNotice(
        autocompleteCapturePlans.length > 0
          ? `ChatGPT용 전체 패키지를 복사했습니다. 선택한 자동완성 캡처 ${autocompleteCapturePlans.length}장을 ChatGPT Pro에 함께 첨부해 주세요.`
          : `ChatGPT용 전체 패키지와 후보 ${feed.opportunities.length}개를 복사했습니다.`,
      );
    } catch (caught) {
      const message =
        caught instanceof Error &&
        (caught.message === "복사할 뉴스 후보가 없습니다." ||
          caught.message === "ChatGPT용 전체 패키지를 생성하지 못했습니다.")
          ? caught.message
          : "클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.";

      setError(message);
      setCopyingPackage(false);
      setCopyProgress(0);
      setCopyStatus("");
      return;
    } finally {
      window.setTimeout(() => {
        setCopyingPackage(false);
        setCopyProgress(0);
        setCopyStatus("");
      }, 1400);
    }
  }

  function toggleManualAutocompleteCapture(item: NewsOpportunity) {
    setManualAutocompleteQueries((current) => {
      if (item.id in current) {
        const next = { ...current };
        delete next[item.id];
        return next;
      }

      return {
        ...current,
        [item.id]: item.autocomplete.query || item.searchKeyword || item.longtailHint,
      };
    });
  }

  function updateManualAutocompleteQuery(item: NewsOpportunity, value: string) {
    setManualAutocompleteQueries((current) => ({
      ...current,
      [item.id]: value,
    }));
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
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, categorySelection);
    setNotice("프롬프트, 기존 글 목록, 선택 카테고리를 현재 브라우저에 저장했습니다.");
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
            <p>전체 카테고리를 한 번에 훑거나 특정 카테고리만 집중해서 볼 수 있습니다.</p>
          </div>
        </div>

        <div className="category-grid">
          <button
            type="button"
            className={`category-card${categorySelection === "all" ? " selected" : ""}`}
            onClick={() => setCategorySelection("all")}
          >
            <strong>전체 4개 카테고리</strong>
            <span>IT·AI · 경제·재테크·투자 · 생활·실용정보 · 취업·자격증·직무</span>
          </button>
          {BLOG_CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`category-card${categorySelection === category.id ? " selected" : ""}`}
              onClick={() => setCategorySelection(category.id)}
            >
              <strong>{category.label}</strong>
              <span>{category.description}</span>
            </button>
          ))}
        </div>

        <div className="control-grid">
          <label>
            <span>최근 뉴스 범위</span>
            <select value={windowHours} onChange={(event) => setWindowHours(Number(event.target.value))}>
              <option value={3}>최근 3시간 (기본)</option>
              <option value={6}>최근 6시간</option>
              <option value={12}>최근 12시간</option>
              <option value={24}>최근 24시간</option>
              <option value={48}>최근 48시간</option>
            </select>
          </label>
          <label>
            <span>표시 후보 수</span>
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
          기본 시드는 카테고리별 넓은 뉴스 탐색어입니다. 추가 시드는 특정 이슈를 놓치지 않기 위한 보조 입력으로만 사용합니다.
        </p>
        {error ? <div className="notice notice--error">{error}</div> : null}
        {notice ? <div className="notice notice--success">{notice}</div> : null}
      </section>

      {loading ? (
        <section className="panel loading-panel">
          <div className="loading-spinner" />
          <strong>뉴스를 사건 단위로 묶고 교차 검증하고 있습니다.</strong>
          <span>뉴스 검색 → Search Trend → Naver 자동완성 → 블로그 경쟁 사전검증 순서로 진행됩니다.</span>
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
                <h2>뉴스 검색 기회 후보</h2>
                <p>예비 AI 추천 점수는 최종 성공 확률이 아니라 심층 검증 순서를 정하는 사전 상대 점수입니다.</p>
              </div>
            </div>

            <div className="opportunity-copy-row">
              <div>
                <strong>후보 {feed.opportunities.length}개 전체를 ChatGPT Pro에서 재검증</strong>
                <span>아래 목록을 끝까지 확인하지 않아도 현재 수집된 전체 후보와 검증 프롬프트가 함께 복사됩니다.</span>
                {autocompleteCapturePlans.length > 0 ? (
                  <span className="capture-selection-note">
                    자동완성 캡처 추가 검증 {autocompleteCapturePlans.length}개 선택됨 · 전체 복사 후 해당 이미지를 ChatGPT Pro에 함께 첨부하세요.
                  </span>
                ) : null}
              </div>
              <button
                className="button button--primary copy-package-button"
                type="button"
                disabled={!researchPackage || copyingPackage}
                aria-busy={copyingPackage}
                onClick={() => void copyResearchPackage()}
              >
                {copyingPackage ? (
                  <>
                    <span className="button-spinner" aria-hidden="true" />
                    <span>{copyProgress === 100 ? "복사 완료" : "복사 중…"}</span>
                  </>
                ) : (
                  "ChatGPT용 전체 복사"
                )}
              </button>
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
                const captureSelected = item.id in manualAutocompleteQueries;
                const captureQuery = captureSelected
                  ? manualAutocompleteQueries[item.id]
                  : item.autocomplete.query || item.searchKeyword || item.longtailHint;
                return (
                  <article className="opportunity-card" key={item.id}>
                    <div className="opportunity-card__top">
                      <div className="rank-badge">{item.rank}</div>
                      <div className="opportunity-title">
                        <div className="badge-row">
                          <span className="badge badge--category">{item.categoryLabel}</span>
                          <span className={`badge badge--velocity badge--${item.newsVelocityLabel}`}>{item.newsVelocityLabel}</span>
                          <span className={`badge risk risk--${item.competition.riskLevel.replace(" ", "-")}`}>경쟁 {item.competition.riskLevel}</span>
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
                      <div>
                        <span>대표 롱테일 힌트</span>
                        <strong className="longtail">{item.longtailHint}</strong>
                        <small>최종 표현은 ChatGPT가 SERP 재검증</small>
                      </div>
                    </div>

                    <div className={`manual-autocomplete-card${captureSelected ? " is-selected" : ""}`}>
                      <label className="manual-autocomplete-toggle">
                        <input
                          type="checkbox"
                          checked={captureSelected}
                          onChange={() => toggleManualAutocompleteCapture(item)}
                        />
                        <span>
                          <strong>자동완성 캡처 추가 검증</strong>
                          <small>이 후보만 네이버 검색창 자동완성 화면을 직접 캡처해 ChatGPT Pro의 롱테일 검증에 추가합니다.</small>
                        </span>
                      </label>

                      {captureSelected ? (
                        <div className="manual-autocomplete-config">
                          <label>
                            <span>캡처 기준 검색어</span>
                            <input
                              value={captureQuery}
                              onChange={(event) =>
                                updateManualAutocompleteQuery(item, event.target.value)
                              }
                              placeholder={item.autocomplete.query || item.searchKeyword}
                            />
                          </label>
                          <button
                            className="button button--secondary manual-autocomplete-copy"
                            type="button"
                            onClick={() =>
                              void copyText(
                                captureQuery.trim() || item.autocomplete.query,
                                `후보 ${item.rank}의 캡처 기준 검색어를 복사했습니다.`,
                              )
                            }
                          >
                            검색어 복사
                          </button>
                          <small>
                            위 검색어를 네이버 검색창에 입력해 자동완성 목록 전체가 보이도록 캡처한 뒤, “ChatGPT용 전체 복사” 내용과 이미지를 함께 첨부하세요.
                          </small>
                        </div>
                      ) : null}
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
