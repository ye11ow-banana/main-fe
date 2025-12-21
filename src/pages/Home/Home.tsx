import type { UserInfo } from "../../api/auth";
import "./Home.css";

function initialFromName(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

export function Home({ user }: { user: UserInfo }) {
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

          <section className="services-grid">
            <article className="service-card">
              <div className="service-thumbnail" />
              <h2 className="service-title">Cloud Storage</h2>
              <p className="service-description">
                Securely store and access your files from anywhere with high availability.
              </p>
              <div className="service-footer">
                <span className="status-pill status-pill--active">Active</span>
                <a href="#" className="link-button">
                  View details
                </a>
              </div>
            </article>

            <article className="service-card">
              <div className="service-thumbnail" />
              <h2 className="service-title">Analytics Engine</h2>
              <p className="service-description">
                Turn raw data into insights with real-time dashboards and reports.
              </p>
              <div className="service-footer">
                <span className="status-pill status-pill--active">Active</span>
                <a href="#" className="link-button">
                  View details
                </a>
              </div>
            </article>

            <article className="service-card">
              <div className="service-thumbnail" />
              <h2 className="service-title">API Gateway</h2>
              <p className="service-description">
                Manage, monitor, and secure all your APIs in a single place.
              </p>
              <div className="service-footer">
                <span className="status-pill status-pill--inactive">Inactive</span>
                <a href="#" className="link-button">
                  View details
                </a>
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
