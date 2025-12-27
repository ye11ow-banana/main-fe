import { useEffect, useMemo, useState } from "react";
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

export function CaloriesList({ user }: { user: UserInfo }) {
  const defaultEnd = useMemo(() => toDateInputValue(new Date()), []);
  const defaultStart = useMemo(() => toDateInputValue(addDays(new Date(), -30)), []);

  const [trendType, setTrendType] = useState<TrendType>("weight");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

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
      .map((it) => ({ date: it.date, value: toNumber(it.value) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Template uses a static clip-path polygon; we keep the same element but drive
    // the polygon points from API data so it still looks identical.
    if (normalized.length === 0) {
      return {
        hasData: false,
        clipPath:
          "polygon(0% 70%, 12% 50%, 25% 60%, 38% 40%, 52% 45%, 65% 30%, 80% 35%, 100% 20%, 100% 100%, 0% 100%)",
      };
    }

    const values = normalized.map((p) => p.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    const range = maxV - minV;
    const yMin = range === 0 ? minV - 1 : minV;
    const yMax = range === 0 ? maxV + 1 : maxV;

    const topPadPct = 10; // keep a little headroom like the template shape
    const bottomPadPct = 18;

    const n = normalized.length;
    const points = normalized.map((p, i) => {
      const x = n === 1 ? 50 : (i / (n - 1)) * 100;
      const t = yMax === yMin ? 0.5 : (p.value - yMin) / (yMax - yMin);
      const y =
        topPadPct +
        (1 - clamp(t, 0, 1)) * (100 - topPadPct - bottomPadPct);
      return { x, y };
    });

    // Close the polygon to bottom edge like the template.
    const polygon = [
      ...points.map((p) => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`),
      "100% 100%",
      "0% 100%",
    ].join(", ");

    return { hasData: true, clipPath: `polygon(${polygon})` };
  }, [items]);

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
                  <select id="sort" className="filter-select">
                    <option>Most recent</option>
                    <option>Oldest</option>
                    <option>Most calories</option>
                    <option>Lowest weight</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-inner">
                <div className="chart-grid-lines"></div>
                <div className="chart-line" style={{ clipPath: chart.clipPath }} />

                <div className="chart-overlay" aria-live="polite">
                  {isLoading && <span className="chart-overlay__text">Loading trend data…</span>}
                  {!isLoading && error && (
                    <span className="chart-overlay__text chart-overlay__text--error">{error}</span>
                  )}
                  {!isLoading && !error && !chart.hasData && (
                    <span className="chart-overlay__text">No trend data for this range.</span>
                  )}
                </div>
              </div>
              <div className="chart-footer">
                <div className="chart-axis-label">
                  <span className="chart-dot"></span>
                  <span>Daily trend</span>
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
