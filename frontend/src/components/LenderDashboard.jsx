import { useState } from "react";
import { request } from "../api";

export default function LenderDashboard({ session, onLogout }) {
  const [borrowerId, setBorrowerId] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const loadBorrowerScore = async () => {
    if (!borrowerId.trim()) {
      setScoreError("Enter a borrower user ID first.");
      return;
    }

    setLoadingScore(true);
    setScoreError("");
    setChatAnswer("");
    setChatError("");

    try {
      const data = await request(`/lender/score/${borrowerId.trim()}`);
      setScoreData(data);
    } catch (error) {
      setScoreData(null);
      setScoreError(error.message);
    } finally {
      setLoadingScore(false);
    }
  };

  const askCoach = async (event) => {
    event.preventDefault();
    if (!chatQuestion.trim()) return;
    if (!scoreData) {
      setChatError("Load a borrower score before asking the lender coach.");
      return;
    }

    setChatLoading(true);
    setChatError("");
    setChatAnswer("");

    try {
      const data = await request("/chat/lender", {
        method: "POST",
        body: JSON.stringify({
          question: chatQuestion,
          score: scoreData.score,
          riskLevel: scoreData.riskLevel,
          tier: scoreData.tier,
          factors: scoreData.factors || {},
        }),
      });
      setChatAnswer(data.answer || "No answer returned.");
    } catch (error) {
      setChatError(error.message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-6">
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

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-medium text-slate-700">
              Borrower user ID
            </label>
            <div className="mt-3 flex gap-3">
              <input
                value={borrowerId}
                onChange={(event) => setBorrowerId(event.target.value)}
                placeholder="Enter borrower ID"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={loadBorrowerScore}
                disabled={loadingScore || !borrowerId.trim()}
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingScore ? "Loading..." : "Load score"}
              </button>
            </div>
          </div>

          {scoreError && (
            <p className="mt-4 text-sm text-red-600">{scoreError}</p>
          )}

          {scoreData && (
            <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                Borrower profile
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Score
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {scoreData.score}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Risk
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {scoreData.riskLevel || "unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Tier
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {scoreData.tier || "unassigned"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            AI lender coach
          </p>
          <form onSubmit={askCoach} className="mt-4 space-y-3">
            <textarea
              rows="4"
              value={chatQuestion}
              onChange={(event) => setChatQuestion(event.target.value)}
              placeholder={
                scoreData
                  ? "Ask about this borrower’s score, risk, or decision-support context..."
                  : "Load a borrower score first."
              }
              disabled={!scoreData || chatLoading}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!scoreData || chatLoading || !chatQuestion.trim()}
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chatLoading ? "Asking..." : "Ask coach"}
              </button>
            </div>
          </form>

          {chatError && (
            <p className="mt-4 text-sm text-red-600">{chatError}</p>
          )}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {chatAnswer ||
              (scoreData
                ? "Use the AI coach for directional, score-grounded decision support."
                : "No borrower score is loaded yet.")}
          </div>
        </div>
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
