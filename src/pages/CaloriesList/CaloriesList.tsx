import { useEffect, useMemo, useRef, useState } from "react";
import type { UserInfo } from "../../api/auth";
import { ApiError } from "../../api/http";
import {
  getCalorieDateRangeFilters,
  getCalorieDays,
  getCalorieSortBys,
  getCalorieTrendItems,
  type DayFullInfo,
  type DaysSortBy,
  type NameCode,
  type TrendItem,
  type TrendType,
} from "../../api/calories";
import "./CaloriesList.css";

function toDateInputValue(d: Date): string {
  // YYYY-MM-DD in local time
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toNumber(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function formatShortDate(isoDate: string): string {
  // Expect YYYY-MM-DD; fall back to raw string if unexpected.
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(isoDate);
  if (!m) return isoDate;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);

  // Use a compact, readable label like “Aug 24”.
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatValue(value: number, type: TrendType): string {
  if (type === "calorie") return `${Math.round(value)} kcal`;
  return `${value.toFixed(1)} kg`;
}

function formatDayDate(isoDatetime: string): string {
  const dt = new Date(isoDatetime);
  if (Number.isNaN(dt.getTime())) return isoDatetime;
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMaybeKg(v: string | number | null): string {
  if (v == null) return "—";
  const n = toNumber(v);
  return `${n.toFixed(1)} kg`;
}

function formatMaybePercent(v: string | number | null): string {
  if (v == null) return "—";
  const n = toNumber(v);
  return `${n.toFixed(1)}%`;
}

function formatSignedKg(v: string | number | null): string {
  if (v == null) return "—";
  const n = toNumber(v);
  const sign = n > 0 ? "+" : n < 0 ? "–" : "";
  return `${sign}${Math.abs(n).toFixed(1)} kg`;
}

function formatMaybeGrams(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && v.includes("+")) return `${v} g`;
  const n = toNumber(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n)} g`;
}

import { Header } from "../../components/Header/Header";
import { useTheme } from "../../context/ThemeContext";

export function CaloriesList({ user }: { user: UserInfo }) {
  const { theme } = useTheme();
  const defaultEnd = useMemo(() => toDateInputValue(new Date()), []);
  const defaultStart = useMemo(() => toDateInputValue(addDays(new Date(), -30)), []);

  const fallbackSortOptions: NameCode[] = useMemo(
    () => [
      { name: "Most recent", code: "most_recent" },
      { name: "Oldest", code: "oldest" },
      { name: "Most calories", code: "most_calories" },
      { name: "Lowest weight", code: "lowest_weight" },
    ],
    []
  );

  const [trendType, setTrendType] = useState<TrendType>("weight");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [sortBy, setSortBy] = useState<DaysSortBy>("most_recent");
  const [sortOptions, setSortOptions] = useState<NameCode[]>(fallbackSortOptions);

  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const chartTipRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrendItem[] | null>(null);

  const [daysLoading, setDaysLoading] = useState(true);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [daysPage, setDaysPage] = useState(1);
  const [daysPageCount, setDaysPageCount] = useState(1);
  const [days, setDays] = useState<DayFullInfo[]>([]);
  const [openDayId, setOpenDayId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDateRange() {
      try {
        const res = await getCalorieDateRangeFilters();
        if (!isMounted) return;

        const start = res?.data?.start_date;
        const end = res?.data?.end_date;
        if (typeof start === "string" && typeof end === "string" && start && end) {
          setStartDate(start);
          setEndDate(end);
        }
      } catch {
        // Keep defaults if the endpoint is unavailable.
      }
    }

    void loadDateRange();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSortBys() {
      try {
        const res = await getCalorieSortBys();
        if (!isMounted) return;

        const options = Array.isArray(res?.data) ? res.data : [];
        const nextOptions = options.length > 0 ? options : fallbackSortOptions;
        setSortOptions(nextOptions);

        // Keep current selection if still present, otherwise default to first option.
        setSortBy((prev) => {
          if (nextOptions.some((o) => o.code === prev)) return prev;
          return (nextOptions[0]?.code as DaysSortBy | undefined) ?? prev;
        });
      } catch {
        // Keep fallback options.
      }
    }

    void loadSortBys();
    return () => {
      isMounted = false;
    };
  }, [fallbackSortOptions]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await getCalorieTrendItems({
          start_date: startDate,
          end_date: endDate,
          type: trendType,
        });
        if (!isMounted) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (!isMounted) return;
        if (err instanceof ApiError) setError(err.message);
        else setError("Unexpected error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [endDate, startDate, trendType]);

  useEffect(() => {
    setDaysPage(1);
    setOpenDayId(null);
  }, [endDate, startDate, sortBy]);

  useEffect(() => {
    let isMounted = true;

    async function loadDays() {
      setDaysLoading(true);
      setDaysError(null);

      try {
        const res = await getCalorieDays({
          start_date: startDate,
          end_date: endDate,
          sort_by: sortBy,
          page: daysPage,
        });

        if (!isMounted) return;

        const payload = res?.data;
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setDays(list);
        setDaysPageCount(typeof payload?.page_count === "number" && payload.page_count > 0 ? payload.page_count : 1);
      } catch (err) {
        if (!isMounted) return;
        if (err instanceof ApiError) setDaysError(err.message);
        else setDaysError("Unexpected error");
      } finally {
        if (isMounted) setDaysLoading(false);
      }
    }

    void loadDays();
    return () => {
      isMounted = false;
    };
  }, [daysPage, endDate, startDate, sortBy]);

  const chart = useMemo(() => {
    const raw = items ?? [];
    const normalized = raw
      .filter((it) => typeof it?.date === "string")
      .map((it) => ({ date: it.date, value: toNumber(it.value) }));

    normalized.sort((a, b) => {
      return a.date.localeCompare(b.date);
    });

    // SVG layout (matches base/calories-list.html viewBox)
    const W = 640;
    const H = 220;
    const padL = 56;
    const padR = 20;
    const padT = 16;
    const padB = 40;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const metricLabel = trendType === "weight" ? "Weight, kg" : "Calories, kcal";
    const ariaLabel = trendType === "weight" ? "Weight over time" : "Calories over time";

    if (normalized.length < 2) {
      return {
        hasData: false,
        W,
        H,
        padL,
        padR,
        padT,
        padB,
        innerW,
        innerH,
        metricLabel,
        ariaLabel,
        series: normalized,
        pts: [] as Array<{ x: number; y: number; date: string; value: number }>,
        lineD: "",
        areaD: "",
        yTicks: [] as Array<{ v: number; y: number }>,
        xLabels: [] as Array<{ x: number; text: string }>,
      };
    }

    // Chart reads left->right time (oldest->newest)
    const series = normalized;

    const vals = series.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const yMin = min - span * 0.15;
    const yMax = max + span * 0.15;

    const xAt = (i: number) => padL + innerW * (i / (series.length - 1 || 1));
    const yAt = (v: number) => padT + innerH * (1 - (v - yMin) / (yMax - yMin));

    const pts = series.map((d, i) => ({ x: xAt(i), y: yAt(d.value), date: d.date, value: d.value }));

    const lineD = pts
      .map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const areaD = `M ${padL} ${padT + innerH} ${lineD.replace(/^M/, "L")} L ${padL + innerW} ${padT + innerH} Z`;

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = yMin + (i * (yMax - yMin)) / ticks;
      return { v, y: yAt(v) };
    });

    const mid = Math.floor((series.length - 1) / 2);
    const xLabels = [
      { x: xAt(0), text: formatShortDate(series[0].date) },
      { x: xAt(mid), text: formatShortDate(series[mid].date) },
      { x: xAt(series.length - 1), text: formatShortDate(series[series.length - 1].date) },
    ];

    return {
      hasData: true,
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      innerW,
      innerH,
      metricLabel,
      ariaLabel,
      series,
      pts,
      lineD,
      areaD,
      yTicks,
      xLabels,
    };
  }, [items, trendType]);

  function updateHoverFromPointer(clientX: number, clientY: number) {
    if (!chart.hasData || chart.pts.length === 0) return;
    const svg = chartSvgRef.current;
    if (!svg) return;

    svg.classList.add("chart-hover");

    const box = svg.getBoundingClientRect();
    const relX = clamp(clientX - box.left, 0, box.width);
    const xSvg = (relX / box.width) * chart.W;

    let best = 0;
    let bestDist = Infinity;
    chart.pts.forEach((p, i) => {
      const dist = Math.abs(p.x - xSvg);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });

    setHoverIndex(best);
    const tip = chartTipRef.current;
    if (tip) {
      const x = clamp(clientX - box.left + 12, 12, box.width - 150);
      const y = clamp(clientY - box.top - 50, 8, box.height - 70);
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    }
  }

  return (
    <div className={`calories-page theme-${theme}`}>
      <Header user={user} />

      <main className="main">
        <div className="container">
          <section className="page-header">
            <h1 className="page-title">Calories &amp; weight</h1>
            <p className="page-subtitle">
              Track your body weight and daily calorie intake over time.
            </p>
          </section>

          <section className="metrics-section">
            <div className="metrics-header">
              <div className="tabs">
                <button
                  className={trendType === "weight" ? "tab tab--active" : "tab"}
                  type="button"
                  onClick={() => setTrendType("weight")}
                >
                  Weight (kg)
                </button>
                <button
                  className={trendType === "calorie" ? "tab tab--active" : "tab"}
                  type="button"
                  onClick={() => setTrendType("calorie")}
                >
                  Calories (kcal)
                </button>
              </div>

              <div className="filters">
                <div className="filter-group">
                  <span className="filter-label">Date range</span>
                  <div className="filter-dates">
                    <input
                      type="date"
                      className="filter-input"
                      placeholder="From"
                      value={startDate}
                      max={endDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="filter-separator">–</span>
                    <input
                      type="date"
                      className="filter-input"
                      placeholder="To"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="sort">
                    Sort by
                  </label>
                  <select
                    id="sort"
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as DaysSortBy)}
                  >
                    {sortOptions.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div
                className="chart-inner"
                onPointerMove={(e) => updateHoverFromPointer(e.clientX, e.clientY)}
                onPointerLeave={() => {
                  const svg = chartSvgRef.current;
                  if (svg) svg.classList.remove("chart-hover");
                  setHoverIndex(null);
                }}
                onPointerDown={(e) => {
                  // tap shows tooltip
                  updateHoverFromPointer(e.clientX, e.clientY);
                }}
              >
                <svg
                  ref={chartSvgRef}
                  className="chart-svg"
                  viewBox={`${0} ${0} ${chart.W} ${chart.H}`}
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  aria-label={chart.ariaLabel}
                >
                  {!isLoading && !error && !chart.hasData && (
                    <text x="50%" y="50%" textAnchor="middle" className="chart-axis-text">
                      Not enough data to plot
                    </text>
                  )}

                  {!isLoading && !error && chart.hasData && (
                    <>
                      <g className="chart-grid">
                        {chart.yTicks.map((t, idx) => (
                          <line
                            key={idx}
                            x1={chart.padL}
                            y1={t.y}
                            x2={chart.padL + chart.innerW}
                            y2={t.y}
                          />
                        ))}
                      </g>

                      <g className="chart-axes">
                        <line x1={chart.padL} y1={chart.padT} x2={chart.padL} y2={chart.padT + chart.innerH} />
                        <line
                          x1={chart.padL}
                          y1={chart.padT + chart.innerH}
                          x2={chart.padL + chart.innerW}
                          y2={chart.padT + chart.innerH}
                        />
                      </g>

                      <g className="chart-ylabels">
                        {chart.yTicks.map((t, idx) => (
                          <text
                            key={idx}
                            className="chart-axis-text"
                            x={chart.padL - 10}
                            y={t.y + 4}
                            textAnchor="end"
                          >
                            {trendType === "weight" ? t.v.toFixed(1) : Math.round(t.v)}
                          </text>
                        ))}
                      </g>

                      <path className="chart-area" d={chart.areaD} />
                      <path className="chart-line" d={chart.lineD} />

                      <g className="chart-points">
                        {chart.pts.map((p, idx) => (
                          <circle key={p.date} className="chart-point" cx={p.x} cy={p.y} r={5} data-i={idx} />
                        ))}
                      </g>

                      <g className="chart-xlabels">
                        {chart.xLabels.map((xl, idx) => (
                          <text
                            key={idx}
                            className="chart-axis-text"
                            x={xl.x}
                            y={chart.padT + chart.innerH + 26}
                            textAnchor="middle"
                          >
                            {xl.text}
                          </text>
                        ))}
                      </g>
                    </>
                  )}
                </svg>

                <div
                  ref={chartTipRef}
                  className="chart-tip"
                  hidden={hoverIndex == null || !chart.hasData}
                >
                  {hoverIndex != null && chart.hasData && (
                    <>
                      <strong>{formatShortDate(chart.series[hoverIndex]?.date ?? "")}</strong>
                      <br />
                      {formatValue(chart.series[hoverIndex]?.value ?? 0, trendType)}
                    </>
                  )}
                </div>

                <div className="chart-overlay" aria-live="polite">
                  {isLoading && <span className="chart-overlay__text">Loading trend data…</span>}
                  {!isLoading && error && (
                    <span className="chart-overlay__text chart-overlay__text--error">{error}</span>
                  )}
                </div>
              </div>
              <div className="chart-footer">
                <div className="chart-axis-label">
                  <span className="chart-dot"></span>
                  <span>{chart.metricLabel}</span>
                </div>
                <span>Date →</span>
              </div>
            </div>
          </section>

          <section className="day-section">
            <div className="day-section-header">
              <div>
                <span>Daily overview</span>
                <br />
                <span style={{ fontSize: 12 }}>Tap a row to view detailed products</span>
              </div>
              <div className="day-section-actions" style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-ghost-nav"
                  type="button"
                  style={{
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)'
                  }}
                  onClick={() => (window.location.href = "/products-list")}
                >
                  Manage products
                </button>
                <button
                  className="btn-add-day"
                  type="button"
                  onClick={() => (window.location.href = "/add-day")}
                >
                  + Add day
                </button>
              </div>
            </div>

            <div className="day-list">
              {daysLoading && (
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Loading days…</div>
              )}

              {!daysLoading && daysError && (
                <div style={{ fontSize: 12, color: "#DC2626" }}>{daysError}</div>
              )}

              {!daysLoading && !daysError && days.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  No days found for the selected range.
                </div>
              )}

              {!daysLoading && !daysError &&
                days.map((day) => {
                  const totalCalories = Math.round(toNumber(day.total_calories)).toLocaleString();
                  const products = Array.isArray(day.products) ? day.products : [];
                  const isOpen = openDayId === day.id;

                  return (
                    <details key={day.id} className="day-card" open={isOpen}>
                      <summary
                        className="day-summary"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenDayId((prev) => (prev === day.id ? null : day.id));
                        }}
                      >
                        <div className="day-summary-main">
                          <div className="day-date">{formatDayDate(day.created_at)}</div>
                          <div className="day-kcal">{totalCalories} kcal total</div>
                        </div>

                        <div className="day-summary-stats">
                          <div className="stat-chip">
                            <span className="stat-label">Proteins</span>
                            <span className="stat-value">{Math.round(toNumber(day.total_proteins))} g</span>
                          </div>
                          <div className="stat-chip">
                            <span className="stat-label">Fats</span>
                            <span className="stat-value">{Math.round(toNumber(day.total_fats))} g</span>
                          </div>
                          <div className="stat-chip">
                            <span className="stat-label">Carbs</span>
                            <span className="stat-value">{Math.round(toNumber(day.total_carbs))} g</span>
                          </div>
                          <div className="stat-chip">
                            <span className="stat-label">Weight</span>
                            <span className="stat-value">{formatMaybeKg(day.body_weight)}</span>
                          </div>
                          <div className="stat-chip">
                            <span className="stat-label">Fat %</span>
                            <span className="stat-value">{formatMaybePercent(day.body_fat)}</span>
                          </div>
                          <div className="stat-chip">
                            <span className="stat-label">Trend</span>
                            <span className="stat-value">{formatSignedKg(day.trend)}</span>
                          </div>
                        </div>

                        <span className="day-toggle-icon">⌄</span>
                      </summary>

                      <div className="day-details">
                        <div className="day-details-title">Products eaten</div>
                        <ul className="product-list">
                          {products.length === 0 && (
                            <li className="product-item">
                              <span className="product-name">No products</span>
                              <span className="product-weight"></span>
                              <span className="product-kcal"></span>
                            </li>
                          )}

                          {products.map((p) => (
                            <li key={p.id} className="product-item">
                              <span className="product-name">{p.name}</span>
                              <span className="product-weight">{formatMaybeGrams(p.weight)}</span>
                              <span className="product-kcal">{Math.round(toNumber(p.calories))} kcal</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  );
                })}
            </div>

            {daysPageCount > 1 && (
              <nav className="pagination" aria-label="Pagination">
                <a
                  href="#"
                  className="page-btn page-btn--ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    if (daysPage > 1) setDaysPage((p) => p - 1);
                  }}
                >
                  Previous
                </a>

                {(() => {
                  const maxBtns = 7;
                  const start = clamp(daysPage - 3, 1, Math.max(1, daysPageCount - maxBtns + 1));
                  const end = Math.min(daysPageCount, start + maxBtns - 1);
                  const pages: number[] = [];
                  for (let i = start; i <= end; i++) pages.push(i);

                  return (
                    <>
                      {start > 1 && (
                        <a
                          href="#"
                          className={daysPage === 1 ? "page-btn page-btn--active" : "page-btn"}
                          onClick={(e) => {
                            e.preventDefault();
                            setDaysPage(1);
                          }}
                        >
                          1
                        </a>
                      )}
                      {start > 2 && (
                        <span
                          className="page-btn page-btn--ghost"
                          aria-hidden="true"
                          style={{ cursor: "default" }}
                        >
                          …
                        </span>
                      )}

                      {pages.map((p) => (
                        <a
                          key={p}
                          href="#"
                          className={p === daysPage ? "page-btn page-btn--active" : "page-btn"}
                          onClick={(e) => {
                            e.preventDefault();
                            setDaysPage(p);
                          }}
                        >
                          {p}
                        </a>
                      ))}

                      {end < daysPageCount - 1 && (
                        <span
                          className="page-btn page-btn--ghost"
                          aria-hidden="true"
                          style={{ cursor: "default" }}
                        >
                          …
                        </span>
                      )}
                      {end < daysPageCount && (
                        <a
                          href="#"
                          className={daysPage === daysPageCount ? "page-btn page-btn--active" : "page-btn"}
                          onClick={(e) => {
                            e.preventDefault();
                            setDaysPage(daysPageCount);
                          }}
                        >
                          {daysPageCount}
                        </a>
                      )}
                    </>
                  );
                })()}

                <a
                  href="#"
                  className="page-btn page-btn--ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    if (daysPage < daysPageCount) setDaysPage((p) => p + 1);
                  }}
                >
                  Next
                </a>
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
