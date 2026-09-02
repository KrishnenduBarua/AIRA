import { useState } from "react";
import { request } from "../api";

export default function BorrowerDashboard({ session, onLogout }) {
  const [consent, setConsent] = useState(Boolean(session.user.consentGiven));
  const [message, setMessage] = useState("");
  const [savingConsent, setSavingConsent] = useState(false);

  const updateConsent = async () => {
    const nextConsent = !consent;
    setMessage("");
    setSavingConsent(true);

    try {
      const data = await request("/auth/consent", {
        method: "POST",
        body: JSON.stringify({ consentGiven: nextConsent }),
      });
      setConsent(Boolean(data.consentGiven));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingConsent(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Borrower dashboard
        </p>
        <h2 className="mt-3 text-3xl font-bold text-slate-900">
          Welcome, {session.user.name}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Your credit profile is ready for review and statement upload.
        </p>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Consent</span>
            <button
              type="button"
              onClick={updateConsent}
              disabled={savingConsent}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${consent ? "bg-brand-100 text-brand-800" : "bg-slate-200 text-slate-600"}`}
            >
              {savingConsent
                ? "Saving..."
                : consent
                  ? "Granted"
                  : "Not granted"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Phone</p>
            <p className="mt-1 font-semibold text-slate-900">
              {session.user.phone}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Status</p>
            <p className="mt-1 font-semibold text-slate-900">
              {session.user.nidVerified ? "Verified" : "Pending"}
            </p>
          </div>
        </div>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Quick actions
        </p>
        <div className="mt-4 space-y-3">
          <button className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white">
            Upload statement
          </button>
          <button className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-semibold text-slate-700">
            View score
          </button>
          <button
            onClick={onLogout}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700"
          >
            Logout
          </button>
        </div>
      </aside>
    </div>
  );
}
