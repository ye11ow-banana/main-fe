import { useState } from "react";
import "./SignIn.css";
import { signIn } from "../../api/auth";
import { ApiError } from "../../api/http";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await signIn({ username, password });

      // Store "bearer <token>" (matches token_type from backend)
      const authHeaderValue = `${res.data.token_type} ${res.data.access_token}`;
      localStorage.setItem("access_token", authHeaderValue);

      // TODO: navigate to your protected page
      // e.g. window.location.href = "/";

      console.log("Signed in");
    } catch (err) {
      if (err instanceof ApiError) {
        let field: string | null = null;

        const payload = err.payload;
        if (isRecord(payload)) {
          const errObj = payload["error"];
          if (isRecord(errObj) && typeof errObj["field"] === "string") {
            field = errObj["field"];
          }
        }

        setError(field ? `${field}: ${err.message}` : err.message);
      } else {
        setError("Unexpected error");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page theme-light">
      <div className="auth-wrapper">
        <div className="auth-card">
          <header className="auth-header">
            <div className="auth-logo" />
            <div>
              <h1 className="auth-heading">Sign in</h1>
              <p className="auth-subtitle">Sign in to your ServiceHub account.</p>
            </div>
          </header>

          <form className="auth-form" onSubmit={onSubmit}>
            {error && (
              <div style={{ fontSize: 13, color: "crimson" }}>{error}</div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="username">
                Username or email
              </label>
              <div className="field-input-wrapper">
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="field-input"
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="field-input-wrapper">
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="field-input"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="field-row">
                <a href="#" className="link-inline">
                  Forgot password?
                </a>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="auth-footer-text">
            Don’t have an account?{" "}
            <a href="/signup" className="link-inline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
