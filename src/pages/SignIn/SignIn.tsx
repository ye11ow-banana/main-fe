import { useEffect, useRef, useState } from "react";
import "./SignIn.css";
import { getMe, signIn, signInWithGoogle, type SignInResponse } from "../../api/auth";
import { ApiError } from "../../api/http";
import { parseApiError } from "../../api/errorParsing";
import { loadGoogleSdk } from "../../lib/google";
import { useTheme } from "../../context/ThemeContext";
import { ThemeToggle } from "../../components/ThemeToggle/ThemeToggle";

type FieldErrors = Record<string, string>;

function validate(values: { username: string; password: string }): {
  fieldErrors: FieldErrors;
  formError: string | null;
} {
  const fieldErrors: FieldErrors = {};
  if (!values.username.trim()) fieldErrors.username = "Username or email is required";
  if (!values.password) fieldErrors.password = "Password is required";
  return { fieldErrors, formError: null };
}

export function SignIn() {
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function finishLogin(res: SignInResponse) {
    const authHeaderValue = `${res.data.token_type} ${res.data.access_token}`;
    localStorage.setItem("access_token", authHeaderValue);
    localStorage.setItem("refresh_token", res.data.refresh_token);

    const me = await getMe();
    if (me.data.is_verified) {
      localStorage.removeItem("pending_email");
      window.location.href = "/";
    } else {
      localStorage.setItem("pending_email", me.data.email);
      window.location.href = "/verify-email";
    }
  }

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId || !googleBtnRef.current) return;

    loadGoogleSdk()
      .then(() => {
        if (!window.google?.accounts?.id || !googleBtnRef.current) {
          throw new Error("Google Sign-In is unavailable");
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential?: string }) => {
            try {
              setError(null);
              if (!response.credential) throw new Error("No Google credential");
              const res = await signInWithGoogle({ id_token: response.credential });
              await finishLogin(res);
            } catch {
              setError("Google sign-in failed");
            }
          },
        });

        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          width: 320,
        });
      })
      .catch(() => setError("Failed to load Google Sign-In"));
  }, [theme]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const local = validate({ username, password });
    if (Object.keys(local.fieldErrors).length > 0) {
      setFieldErrors(local.fieldErrors);
      return;
    }
    setIsLoading(true);

    try {
      const res = await signIn({ username, password });
      await finishLogin(res);
    } catch (err) {
      if (err instanceof ApiError) {
        const parsed = parseApiError(err);
        setError(parsed.formError);
        setFieldErrors(parsed.fieldErrors);
      } else {
        setError("Unexpected error");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`auth-page theme-${theme}`}>
      <div 
        className="theme-toggle-wrapper" 
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 1000
        }}
      >
        <ThemeToggle />
      </div>
      <div className="auth-wrapper">
        <div className="auth-card">
          <header className="auth-header">
            <a href="/" className="auth-logo-link">
              <div className="auth-logo" />
              <div className="logo-text">Cube</div>
            </a>
            <div>
              <h1 className="auth-heading">Sign in</h1>
              <p className="auth-subtitle">Sign in to your Cube account.</p>
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
              {fieldErrors.username && (
                <div style={{ fontSize: 12, color: "crimson" }}>
                  {fieldErrors.username}
                </div>
              )}
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

              {fieldErrors.password && (
                <div style={{ fontSize: 12, color: "crimson" }}>
                  {fieldErrors.password}
                </div>
              )}

              <div className="field-row">
                <a href="#" className="link-inline">
                  Forgot password?
                </a>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </button>

            <div
              style={{
                marginTop: 12,
                height: 1,
                width: "100%",
                backgroundColor: "var(--border, #d1d5db)",
              }}
            />

            <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
              <div className="google-signin-slot" ref={googleBtnRef} />
            </div>
          </form>

          <p className="auth-footer-text">
            Don’t have an account?{" "}
            <a href="/sign-up" className="link-inline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
