import { useEffect, useMemo, useRef, useState } from "react";
import type { UserInfo } from "../../api/auth";
import { ApiError } from "../../api/http";
import { getCalorieTrendItems, type TrendItem, type TrendType } from "../../api/calories";
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

export function CaloriesList({ user }: { user: UserInfo }) {
  const defaultEnd = useMemo(() => toDateInputValue(new Date()), []);
  const defaultStart = useMemo(() => toDateInputValue(addDays(new Date(), -30)), []);

  const [trendType, setTrendType] = useState<TrendType>("weight");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");

  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const chartTipRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrendItem[] | null>(null);

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

  const chart = useMemo(() => {
    const raw = items ?? [];
    const normalized = raw
      .filter((it) => typeof it?.date === "string")
      .map((it) => ({ date: it.date, value: toNumber(it.value) }));

    normalized.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortBy === "oldest" ? cmp : -cmp;
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

    // Chart should read left->right time (oldest->newest)
    const series = sortBy === "recent" ? [...normalized].reverse() : normalized;

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
  }, [items, sortBy, trendType]);

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
    <div className="calories-page theme-light">
      <header className="header">
        <div className="container header-inner">
          <div className="header-left">
            <div className="logo-icon"></div>
            <div className="logo-text">ServiceHub</div>
          </div>

          <div className="header-center">
            <div className="search">
              <div className="search-icon"></div>
              <input
                className="search-input"
                type="text"
                placeholder="Search services…"
              />
            </div>
          </div>

          <div className="header-right">
            <button className="icon-button icon-button--search" aria-label="Search">
              🔍
            </button>

            <button className="icon-button icon-button--bell" aria-label="Notifications">
              <span className="icon-bell" aria-hidden="true"></span>
            </button>

            <div className="avatar-block">
              <img
                className="avatar-image"
                src="/profile.webp"
                alt={`${user.username} profile`}
                loading="lazy"
              />
              <div className="avatar-name">{user.username}</div>
            </div>
          </div>
        </div>
      </header>

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
                    onChange={(e) => setSortBy(e.target.value as "recent" | "oldest")}
                  >
                    <option value="recent">Most recent</option>
                    <option value="oldest">Oldest</option>
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
              <button className="btn-add-day" type="button">
                + Add day
              </button>
            </div>

            <div className="day-list">
              <details className="day-card" open>
                <summary className="day-summary">
                  <div className="day-summary-main">
                    <div className="day-date">Aug 24, 2025</div>
                    <div className="day-kcal">2 150 kcal total</div>
                  </div>

                  <div className="day-summary-stats">
                    <div className="stat-chip">
                      <span className="stat-label">Proteins</span>
                      <span className="stat-value">120 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Fats</span>
                      <span className="stat-value">70 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Carbs</span>
                      <span className="stat-value">230 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Weight</span>
                      <span className="stat-value">68.2 kg</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Fat %</span>
                      <span className="stat-value">18.4%</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Trend</span>
                      <span className="stat-value">–0.3 kg</span>
                    </div>
                  </div>

                  <span className="day-toggle-icon">⌄</span>
                </summary>

                <div className="day-details">
                  <div className="day-details-title">Products eaten</div>
                  <ul className="product-list">
                    <li className="product-item">
                      <span className="product-name">Oatmeal with berries</span>
                      <span className="product-weight">320 g</span>
                      <span className="product-kcal">420 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Chicken breast</span>
                      <span className="product-weight">180 g</span>
                      <span className="product-kcal">330 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Rice &amp; vegetables</span>
                      <span className="product-weight">250 g</span>
                      <span className="product-kcal">410 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Greek yogurt</span>
                      <span className="product-weight">150 g</span>
                      <span className="product-kcal">130 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Snacks &amp; drinks</span>
                      <span className="product-weight">—</span>
                      <span className="product-kcal">860 kcal</span>
                    </li>
                  </ul>
                </div>
              </details>

              <details className="day-card">
                <summary className="day-summary">
                  <div className="day-summary-main">
                    <div className="day-date">Aug 23, 2025</div>
                    <div className="day-kcal">1 930 kcal total</div>
                  </div>

                  <div className="day-summary-stats">
                    <div className="stat-chip">
                      <span className="stat-label">Proteins</span>
                      <span className="stat-value">105 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Fats</span>
                      <span className="stat-value">62 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Carbs</span>
                      <span className="stat-value">210 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Weight</span>
                      <span className="stat-value">68.5 kg</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Fat %</span>
                      <span className="stat-value">18.7%</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Trend</span>
                      <span className="stat-value">–0.1 kg</span>
                    </div>
                  </div>

                  <span className="day-toggle-icon">⌄</span>
                </summary>

                <div className="day-details">
                  <div className="day-details-title">Products eaten</div>
                  <ul className="product-list">
                    <li className="product-item">
                      <span className="product-name">Scrambled eggs</span>
                      <span className="product-weight">220 g</span>
                      <span className="product-kcal">380 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Salmon &amp; quinoa</span>
                      <span className="product-weight">260 g</span>
                      <span className="product-kcal">520 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Salad</span>
                      <span className="product-weight">180 g</span>
                      <span className="product-kcal">210 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Cottage cheese</span>
                      <span className="product-weight">150 g</span>
                      <span className="product-kcal">160 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Snacks &amp; drinks</span>
                      <span className="product-weight">—</span>
                      <span className="product-kcal">660 kcal</span>
                    </li>
                  </ul>
                </div>
              </details>

              <details className="day-card">
                <summary className="day-summary">
                  <div className="day-summary-main">
                    <div className="day-date">Aug 22, 2025</div>
                    <div className="day-kcal">2 280 kcal total</div>
                  </div>

                  <div className="day-summary-stats">
                    <div className="stat-chip">
                      <span className="stat-label">Proteins</span>
                      <span className="stat-value">130 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Fats</span>
                      <span className="stat-value">75 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Carbs</span>
                      <span className="stat-value">240 g</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Weight</span>
                      <span className="stat-value">68.8 kg</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Fat %</span>
                      <span className="stat-value">18.9%</span>
                    </div>
                    <div className="stat-chip">
                      <span className="stat-label">Trend</span>
                      <span className="stat-value">+0.1 kg</span>
                    </div>
                  </div>

                  <span className="day-toggle-icon">⌄</span>
                </summary>

                <div className="day-details">
                  <div className="day-details-title">Products eaten</div>
                  <ul className="product-list">
                    <li className="product-item">
                      <span className="product-name">Porridge with banana</span>
                      <span className="product-weight">300 g</span>
                      <span className="product-kcal">430 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Turkey &amp; buckwheat</span>
                      <span className="product-weight">270 g</span>
                      <span className="product-kcal">540 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Pasta with vegetables</span>
                      <span className="product-weight">260 g</span>
                      <span className="product-kcal">520 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Protein bar</span>
                      <span className="product-weight">60 g</span>
                      <span className="product-kcal">240 kcal</span>
                    </li>
                    <li className="product-item">
                      <span className="product-name">Snacks &amp; drinks</span>
                      <span className="product-weight">—</span>
                      <span className="product-kcal">550 kcal</span>
                    </li>
                  </ul>
                </div>
              </details>
            </div>

            <nav className="pagination" aria-label="Pagination">
              <a href="#" className="page-btn page-btn--ghost" onClick={(e) => e.preventDefault()}>
                Previous
              </a>
              <a href="#" className="page-btn page-btn--active" onClick={(e) => e.preventDefault()}>
                1
              </a>
              <a href="#" className="page-btn" onClick={(e) => e.preventDefault()}>
                2
              </a>
              <a href="#" className="page-btn" onClick={(e) => e.preventDefault()}>
                3
              </a>
              <a href="#" className="page-btn page-btn--ghost" onClick={(e) => e.preventDefault()}>
                Next
              </a>
            </nav>
          </section>
        </div>
      </main>
    </div>
  );
}
