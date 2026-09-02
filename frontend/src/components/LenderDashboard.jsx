import { useCallback, useEffect, useState } from "react";
import { API_URL, request } from "../api";

export default function LenderDashboard({ session, onLogout }) {
  const [borrowerId, setBorrowerId] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [loanRequests, setLoanRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const loadLoanRequests = useCallback(async () => {
    try {
      const data = await request("/loans/requests");
      setLoanRequests(data.requests || []);
      setPendingCount(data.pendingCount || 0);
      setRequestError("");
    } catch (error) {
      setRequestError(error.message);
    }
  }, []);

  useEffect(() => {
    loadLoanRequests();
  }, [loadLoanRequests]);

  const openRequest = async (requestId) => {
    setSelectedRequest(requestId);
    setRequestDetail(null);
    setRequestError("");
    setDetailLoading(true);

    try {
      setRequestDetail(await request(`/loans/requests/${requestId}`));
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const decide = async (status) => {
    if (!selectedRequest) return;
    setDeciding(true);
    setRequestError("");

    try {
      await request(`/loans/requests/${selectedRequest}/decision`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await loadLoanRequests();
      await openRequest(selectedRequest);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setDeciding(false);
    }
  };

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              View loan requests
            </p>
            {pendingCount > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                {pendingCount} new
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Borrowers who applied to your organization. Open a request to verify
            their profile, statements, and trust score.
          </p>

          {requestError && (
            <p className="mt-4 text-sm text-red-600">{requestError}</p>
          )}

          <div className="mt-4 space-y-3">
            {loanRequests.length === 0 && !requestError && (
              <p className="text-sm text-slate-500">
                No loan requests have been received yet.
              </p>
            )}

            {loanRequests.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openRequest(item.id)}
                className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${
                  selectedRequest === item.id
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 bg-slate-50 hover:border-brand-300"
                }`}
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {item.borrowerName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.borrowerPhone} ·{" "}
                    {item.borrowerNidVerified ? "NID verified" : "NID pending"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    item.status === "pending"
                      ? "bg-amber-100 text-amber-800"
                      : item.status === "accepted"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {item.status}
                </span>
              </button>
            ))}
          </div>

          {detailLoading && (
            <p className="mt-4 text-sm text-slate-500">Loading profile...</p>
          )}

          {requestDetail && (
            <div className="mt-6 space-y-4 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                  Borrower profile
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {requestDetail.borrower.name}
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Phone", requestDetail.borrower.phone],
                  ["NID number", requestDetail.borrower.nidNumber],
                  ["Date of birth", requestDetail.borrower.dateOfBirth],
                  [
                    "Identity",
                    requestDetail.borrower.nidVerified ? "Verified" : "Pending",
                  ],
                  ["Address", requestDetail.borrower.permanentAddress],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {value || "—"}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Trust score
                </p>
                {requestDetail.score ? (
                  <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50 p-4">
                    <div className="flex items-end gap-3">
                      <span className="text-3xl font-bold text-slate-900">
                        {requestDetail.score.score}
                      </span>
                      <span className="text-sm text-slate-600">
                        {requestDetail.score.riskLevel} ·{" "}
                        {requestDetail.score.tier}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {Object.entries(requestDetail.score.factors || {})
                        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                        .map(([factor, value]) => (
                          <div
                            key={factor}
                            className="flex justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-600">{factor}</span>
                            <span
                              className={`font-semibold ${Number(value) >= 0 ? "text-green-700" : "text-red-600"}`}
                            >
                              {Number(value).toFixed(4)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    This borrower has not computed a trust score yet.
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Uploaded statements
                </p>
                {requestDetail.statements.length === 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    No statements uploaded.
                  </p>
                )}
                <div className="mt-2 space-y-2">
                  {requestDetail.statements.map((statement) => (
                    <div
                      key={statement.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {statement.filename}
                        </p>
                        <p className="text-xs text-slate-500">
                          {statement.verified ? "Verified" : "Unverified"}
                        </p>
                      </div>
                      <a
                        href={`${API_URL}/loans/requests/${requestDetail.request.id}/statements/${statement.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        View statement
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {requestDetail.request.status === "pending" && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => decide("accepted")}
                    disabled={deciding}
                    className="flex-1 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Select for loan
                  </button>
                  <button
                    type="button"
                    onClick={() => decide("declined")}
                    disabled={deciding}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              )}
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
