import { API_URL } from "../api";
import MarkdownResponse from "./MarkdownResponse";

const field = (label, value) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</p>
  </div>
);

function ScoreCard({ score }) {
  if (!score)
    return (
      <p className="mt-2 text-sm text-slate-500">
        This borrower has not computed a trust score yet.
      </p>
    );

  return (
    <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50 p-4">
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-slate-900">{score.score}</span>
        <span className="text-sm text-slate-600">
          {score.riskLevel} · {score.tier}
        </span>
      </div>
      <div className="mt-4 space-y-1.5">
        {Object.entries(score.factors || {})
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .map(([factor, value]) => (
            <div key={factor} className="flex justify-between gap-3 text-xs">
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
  );
}

export function LenderCoach({
  scoreData,
  question,
  messages,
  error,
  loading,
  onQuestionChange,
  onSubmit,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
        AI lender coach
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-4 max-h-[28rem] min-h-32 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {messages.length
          ? messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-6 rounded-lg bg-brand-100 p-3 text-brand-950"
                    : "mr-6 rounded-lg bg-white p-3"
                }
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {message.role === "user" ? "You" : "AIRA Coach"}
                </p>
                <MarkdownResponse>{message.content}</MarkdownResponse>
              </div>
            ))
          : "Ask the coach for directional, score-grounded decision support."}
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <textarea
          rows="6"
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={
            scoreData
              ? "Ask about this borrower’s score, risk, or decision-support context..."
              : "This borrower has no score to review yet."
          }
          disabled={!scoreData || loading}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!scoreData || loading || !question.trim()}
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Asking..." : "Ask coach"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RequestList({ requests, pendingCount, error, onOpen }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
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
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-4 space-y-3">
        {requests.length === 0 && !error && (
          <p className="text-sm text-slate-500">
            No loan requests have been received yet.
          </p>
        )}
        {requests.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-300"
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
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${item.status === "pending" ? "bg-amber-100 text-amber-800" : item.status === "accepted" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}
            >
              {item.status}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Statements({ request }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <p className="text-sm font-semibold text-slate-800">
        Uploaded statements
      </p>
      {request.statements.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No statements uploaded.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {request.statements.map((statement) => (
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
                href={`${API_URL}/loans/requests/${request.request.id}/statements/${statement.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                View statement
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function LenderReview({ detail, deciding, onDecision }) {
  const borrower = detail.borrower;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Borrower profile
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          {borrower.name}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Request status:{" "}
          <span className="font-semibold capitalize">
            {detail.request.status}
          </span>
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {field("Phone", borrower.phone)}
          {field("NID number", borrower.nidNumber)}
          {field("Date of birth", borrower.dateOfBirth)}
          {field("Identity", borrower.nidVerified ? "Verified" : "Pending")}
          {field("Address", borrower.permanentAddress)}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-slate-800">Trust score</p>
        <ScoreCard score={detail.score} />
      </section>
      <Statements request={detail} />
      {detail.request.status === "pending" && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onDecision("accepted")}
            disabled={deciding}
            className="flex-1 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Select for loan
          </button>
          <button
            type="button"
            onClick={() => onDecision("declined")}
            disabled={deciding}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

export default function LenderDashboardView({
  session,
  onLogout,
  requests,
  pendingCount,
  requestError,
  onOpenRequest,
  borrowerId,
  onBorrowerIdChange,
  loadingScore,
  scoreError,
  scoreData,
  onLoadScore,
  question,
  messages,
  chatError,
  chatLoading,
  onQuestionChange,
  onAskCoach,
  selectedRequest,
  requestDetail,
  detailLoading,
  onBack,
  deciding,
  onDecision,
}) {
  if (detailLoading || requestDetail)
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-brand-400 hover:text-brand-700"
        >
          <span aria-hidden="true">←</span> Back to dashboard
        </button>
        {requestError && <p className="text-sm text-red-600">{requestError}</p>}
        {detailLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-soft">
            Loading borrower profile...
          </div>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <LenderReview
              detail={requestDetail}
              deciding={deciding}
              onDecision={onDecision}
            />
            <div className="xl:sticky xl:top-6 xl:self-start">
              <LenderCoach
                scoreData={scoreData}
                question={question}
                messages={messages}
                error={chatError}
                loading={chatLoading}
                onQuestionChange={onQuestionChange}
                onSubmit={onAskCoach}
              />
            </div>
          </div>
        )}
      </div>
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
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
              Borrower user ID or phone
            </label>
            <div className="mt-3 flex gap-3">
              <input
                value={borrowerId}
                onChange={(event) => onBorrowerIdChange(event.target.value)}
                placeholder="Enter borrower ID or phone"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={onLoadScore}
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
            <section className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                Borrower profile
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {field("Score", scoreData.score)}
                {field("Risk", scoreData.riskLevel || "unknown")}
                {field("Tier", scoreData.tier || "unassigned")}
              </div>
            </section>
          )}
        </section>
        <RequestList
          requests={requests}
          pendingCount={pendingCount}
          error={requestError}
          onOpen={onOpenRequest}
        />
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Actions
        </p>
        <div className="mt-4 space-y-3">
          <button
            type="button"
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
