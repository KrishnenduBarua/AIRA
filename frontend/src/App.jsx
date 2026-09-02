import { useEffect, useState } from "react";
import BorrowerDashboard from "./components/BorrowerDashboard";
import LenderDashboard from "./components/LenderDashboard";
import AdminDashboard from "./components/AdminDashboard";
import AuthFlow from "./components/AuthFlow";
import { request } from "./api";

export default function App() {
  const isAdminUrl = window.location.pathname.startsWith("/admin");
  const [portalRole, setPortalRole] = useState(() =>
    isAdminUrl
      ? "admin"
      : localStorage.getItem("aira_portal_role") || "borrower",
  );
  const [session, setSession] = useState(null);

  useEffect(() => {
    request(`/auth/session?role=${portalRole}`)
      .then((data) => setSession(data.user?.role === portalRole ? data : null))
      .catch(() => setSession(null));
  }, [portalRole]);

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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
              AIRA
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Alternative Credit Intelligence
            </h1>
          </div>

          {isAdminUrl ? (
            <p className="text-sm font-semibold capitalize text-slate-600">
              Admin portal
            </p>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {["borrower", "lender"].map((role) => (
                <button
                  key={role}
                  type="button"
                  disabled={Boolean(session)}
                  onClick={() => selectPortal(role)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${portalRole === role ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-200"}`}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </header>

        {!session ? (
          <div className="mx-auto max-w-xl">
            <AuthFlow mode={portalRole} onSuccess={setSession} />
          </div>
        ) : session.user.role !== portalRole ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-red-700">
            This account cannot access this portal.
          </div>
        ) : portalRole === "borrower" ? (
          <BorrowerDashboard session={session} onLogout={logout} />
        ) : portalRole === "lender" ? (
          <LenderDashboard session={session} onLogout={logout} />
        ) : (
          <AdminDashboard session={session} onLogout={logout} />
        )}
      </div>
    </main>
  );
}
