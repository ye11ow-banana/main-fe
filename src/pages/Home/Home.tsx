import { useEffect, useMemo, useState } from "react";
import type { UserInfo } from "../../api/auth";
import { getApps, type AppDTO } from "../../api/apps";
import { ApiError } from "../../api/http";
import "./Home.css";

function initialFromName(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

export function Home({ user }: { user: UserInfo }) {
  const [apps, setApps] = useState<AppDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await getApps();
        const list = Array.isArray(res.data) ? res.data : [res.data];
        if (isMounted) setApps(list);
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
  }, []);

  const content = useMemo(() => {
    if (isLoading) {
      return <p style={{ fontSize: 13, opacity: 0.8 }}>Loading services…</p>;
    }

    if (error) {
      return <p style={{ fontSize: 13, color: "crimson" }}>{error}</p>;
    }

    if (!apps || apps.length === 0) {
      return <p style={{ fontSize: 13, opacity: 0.8 }}>No services available.</p>;
    }

    return (
      <section className="services-grid">
        {apps.map((app) => (
          <article key={app.id} className="service-card">
            <div
              className="service-thumbnail"
              style={app.image ? { backgroundImage: `url(${app.image})` } : undefined}
            />
            <h2 className="service-title">{app.name}</h2>
            <p className="service-description">{app.description}</p>
            <div className="service-footer">
              <span
                className={
                  app.is_active
                    ? "status-pill status-pill--active"
                    : "status-pill status-pill--inactive"
                }
              >
                {app.is_active ? "Active" : "Inactive"}
              </span>
              <a href="#" className="link-button">
                View details
              </a>
            </div>
          </article>
        ))}
      </section>
    );
  }, [apps, error, isLoading]);

  return (
    <div className="home-page theme-light">
      <header className="header">
        <div className="container header-inner">
          <div className="header-left">
            <div className="logo-icon" />
            <div className="logo-text">ServiceHub</div>
          </div>

          <div className="header-center">
            <div className="search">
              <div className="search-icon" />
              <input className="search-input" type="text" placeholder="Search services…" />
            </div>
          </div>

          <div className="header-right">
            <button className="icon-button icon-button--search" aria-label="Search">
              🔍
            </button>
            <button className="icon-button icon-button--bell" aria-label="Notifications">
              🔔
            </button>

            <div className="avatar-block">
              <div className="avatar-circle">{initialFromName(user.username)}</div>
              <div className="avatar-name">{user.username}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <section className="page-header">
            <h1 className="page-title">Our Services</h1>
            <p className="page-subtitle">
              Manage and explore all available services in one place.
            </p>
          </section>

          {content}
        </div>
      </main>
    </div>
  );
}
