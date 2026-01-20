import { useEffect, useState } from "react";
import { ApiError } from "./api/http";
import { getMe, type UserInfo } from "./api/auth";
import { Home } from "./pages/Home/Home";
import { CaloriesList } from "./pages/CaloriesList/CaloriesList";
import { AddDay } from "./pages/AddDay/AddDay";
import { SignIn } from "./pages/SignIn/SignIn";
import { SignUp } from "./pages/SignUp/SignUp";
import { VerifyEmail } from "./pages/VerifyEmail/VerifyEmail";

function hasAccessToken() {
  return Boolean(localStorage.getItem("access_token"));
}

type AuthState =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: UserInfo };

function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() =>
    hasAccessToken() ? { status: "checking" } : { status: "unauthenticated" }
  );

  useEffect(() => {
    if (!hasAccessToken()) return;

    let cancelled = false;
    getMe()
      .then((res) => {
        if (cancelled) return;
        setState({ status: "authenticated", user: res.data });
      })
      .catch((err) => {
        if (cancelled) return;

        // Token might be expired/invalid.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("pending_email");
        }
        setState({ status: "unauthenticated" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  return pathname;
}

export default function App() {
  const pathname = usePathname();
  const auth = useAuthState();

  function redirect(to: string) {
    if (window.location.pathname !== to) {
      window.location.replace(to);
    }
    return null;
  }

  if (auth.status === "checking") {
    return null;
  }

  // Requirement: Signup page must be the default when user is not authenticated.
  if (auth.status === "unauthenticated") {
    if (pathname === "/sign-in" || pathname === "/signin") return <SignIn />;
    if (pathname === "/sign-up" || pathname === "/signup" || pathname === "/") return <SignUp />;
    return redirect("/sign-up");
  }

  // Authenticated
  if (!auth.user.is_verified) {
    // Only verify-email is available.
    if (pathname === "/verify-email") return <VerifyEmail />;
    return redirect("/verify-email");
  }

  // Authenticated + verified
  if (
    pathname === "/sign-up" ||
    pathname === "/signup" ||
    pathname === "/sign-in" ||
    pathname === "/signin" ||
    pathname === "/verify-email"
  ) {
    return redirect("/");
  }

  // Default signed-in route
  if (pathname === "/") return <Home user={auth.user} />;

  if (pathname === "/calories" || pathname === "/calories-list") {
    return <CaloriesList user={auth.user} />;
  }

  if (pathname === "/add-day") {
    return <AddDay user={auth.user} />;
  }

  // Future pages will be added here; for now route unknown paths to home.
  return redirect("/");
}
