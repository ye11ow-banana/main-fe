import { useMemo, useState } from "react";
import "../SignIn/SignIn.css";
import "./VerifyEmail.css";
import { sendEmailVerificationCode, verifyEmail } from "../../api/auth";
import { ApiError } from "../../api/http";
import { parseApiError } from "../../api/errorParsing";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

import { useTheme } from "../../context/ThemeContext";
import { ThemeToggle } from "../../components/ThemeToggle/ThemeToggle";

export function VerifyEmail() {
  const { theme, toggleTheme } = useTheme();
  const email = useMemo(() => localStorage.getItem("pending_email"), []);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setInfo(null);

    const digits = onlyDigits(code);
    if (digits.length !== 6) {
      setFieldErrors({ code: "Enter the 6-digit code" });
      return;
    }

    setIsLoading(true);
    try {
      await verifyEmail({ code: Number(digits) });
      localStorage.removeItem("pending_email");
      window.location.href = "/";
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

  async function onResend(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setInfo(null);
    setIsLoading(true);
    try {
      await sendEmailVerificationCode();
      setInfo("Verification code resent");
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
            <div className="auth-logo" />
            <div>
              <h1 className="auth-heading">Verify your email</h1>
              <p className="auth-subtitle">
                Enter the 6-digit code we’ve sent to your email.
              </p>
              {email && (
                <p className="auth-email-hint">
                  We sent the code to <strong>{email}</strong>.
                </p>
              )}
            </div>
          </header>

          <form className="auth-form" onSubmit={onSubmit}>
            {error && (
              <div style={{ fontSize: 13, color: "crimson" }}>{error}</div>
            )}
            {info && <div style={{ fontSize: 13 }}>{info}</div>}

            <div className="field-group">
              <label className="field-label" htmlFor="code">
                Verification code
              </label>
              <div className="field-input-wrapper">
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  className="field-input"
                  placeholder="123456"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(onlyDigits(e.target.value).slice(0, 6))}
                  disabled={isLoading}
                  required
                />
              </div>
              {fieldErrors.code && (
                <div style={{ fontSize: 12, color: "crimson" }}>{fieldErrors.code}</div>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Continue"}
            </button>
          </form>

          <div className="auth-footer">
            <div className="auth-footer-row">
              <span>Didn’t receive the code?</span>
              <a href="#" className="link-inline" onClick={onResend}>
                Resend
              </a>
            </div>
            <div className="auth-footer-row">
              <span>Wrong email address?</span>
              <a href="/sign-up" className="link-inline">
                Change email
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
