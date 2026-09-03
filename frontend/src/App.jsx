import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import AuthFlow from "./components/AuthFlow";
import LandingPage from "./components/LandingPage";
import { request } from "./api";
import { LANGUAGES, LanguageProvider, useLanguage } from "./i18n";
import { Alert, Button, Card, Skeleton, cx } from "./ui/primitives";

// Dashboards are split out of the initial bundle: a borrower on a slow
// connection only downloads the portal they actually sign in to.
const BorrowerDashboard = lazy(() => import("./components/BorrowerDashboard"));
const LenderDashboard = lazy(() => import("./components/LenderDashboard"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));

function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("app.language")}
      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.code}
          aria-pressed={language === option.code}
          onClick={() => setLanguage(option.code)}
          className={cx(
            "min-h-9 rounded-lg px-3 text-sm font-semibold transition",
            language === option.code
              ? "bg-brand-700 text-white"
              : "text-slate-600 hover:bg-slate-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DashboardFallback() {
  return (
    <Card>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </Card>
  );
}

function Shell() {
  const { t } = useLanguage();
  const isLandingPage =
    window.location.pathname === "/" || window.location.pathname === "/landing";
  const isAdminUrl = window.location.pathname.startsWith("/admin");
  const [portalRole, setPortalRole] = useState(() =>
    isAdminUrl ? "admin" : localStorage.getItem("aira_portal_role") || "borrower",
  );
  const [session, setSession] = useState(null);
  const [sessionState, setSessionState] = useState("loading");

  const loadSession = useCallback(() => {
    let active = true;
    setSessionState("loading");
    request(`/auth/session?role=${portalRole}`)
      .then((data) => {
        if (!active) return;
        setSession(data.user?.role === portalRole ? data : null);
        setSessionState("ready");
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setSessionState("ready");
      });
    return () => {
      active = false;
    };
  }, [portalRole]);

  useEffect(loadSession, [loadSession]);

  const selectPortal = (role) => {
    if (isAdminUrl || session) return;
    localStorage.setItem("aira_portal_role", role);
    setPortalRole(role);
  };

  const logout = async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
    }
  };

  const dashboardProps = { session, onLogout: logout };

  if (isLandingPage) return <LandingPage />;

  return (
    <div className="aira-app-shell min-h-screen bg-slate-100 text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t("app.skipToContent")}
      </a>

      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        <header className="aira-header mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft sm:mb-6 sm:p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/favicon.ico"
              alt=""
              width="44"
              height="44"
              className="aira-brand-mark h-11 w-11 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-brand-700">
                {t("app.name")}
              </p>
              <h1 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                {t("app.tagline")}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageToggle />
            {isAdminUrl ? (
              <p className="text-sm font-semibold text-slate-600">
                {t("app.adminPortal")}
              </p>
            ) : (
              <div
                role="group"
                aria-label={t("app.name")}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
              >
                {["borrower", "lender"].map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={Boolean(session)}
                    aria-pressed={portalRole === role}
                    onClick={() => selectPortal(role)}
                    className={cx(
                      "min-h-9 rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed",
                      portalRole === role
                        ? "bg-brand-700 text-white"
                        : "text-slate-600 hover:bg-slate-200 disabled:opacity-50",
                    )}
                  >
                    {t(`app.${role}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main id="main" tabIndex={-1} className="outline-none">
          {sessionState === "loading" ? (
            <DashboardFallback />
          ) : !session ? (
            <div className="mx-auto w-full max-w-xl">
              <AuthFlow mode={portalRole} onSuccess={setSession} />
            </div>
          ) : session.user.role !== portalRole ? (
            <div className="mx-auto w-full max-w-xl">
              <Alert variant="error" title={t("app.wrongPortal")}>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={logout}
                >
                  {t("common.logout")}
                </Button>
              </Alert>
            </div>
          ) : (
            <Suspense fallback={<DashboardFallback />}>
              {portalRole === "borrower" ? (
                <BorrowerDashboard {...dashboardProps} />
              ) : portalRole === "lender" ? (
                <LenderDashboard {...dashboardProps} />
              ) : (
                <AdminDashboard {...dashboardProps} />
              )}
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <Shell />
    </LanguageProvider>
  );
}
