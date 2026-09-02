export default function LenderDashboard({ session, onLogout }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Lender workspace
        </p>
        <h2 className="mt-3 text-3xl font-bold text-slate-900">
          Welcome, {session.user.name}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Lender onboarding is approved only after admin verification.
        </p>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Actions
        </p>
        <div className="mt-4 space-y-3">
          <button className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white">
            Review borrower profile
          </button>
          <button className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-semibold text-slate-700">
            View risk portfolio
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
