import MarkdownResponse from "./MarkdownResponse";

function Coach({
  scoreData,
  question,
  messages,
  error,
  loading,
  onQuestionChange,
  onSubmit,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
        AI borrower coach
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
          : scoreData
            ? "Ask the coach for guidance on your score, risk factors, and practical next steps."
            : "Your latest score is not available yet. Compute a score before using the AI coach."}
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <textarea
          rows="4"
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={
            scoreData
              ? "Ask about your score, risk, or improvement plan..."
              : "Score is not available yet."
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
    </section>
  );
}

function LenderList({ lenders, error, requestingId, onRequest }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Available lenders
        </p>
        <span className="text-xs text-slate-500">
          {lenders.length} partner{lenders.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Send a loan request to a partner lender. They will be able to review
        your profile, statements, and trust score.
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-4 space-y-3">
        {lenders.length === 0 && !error && (
          <p className="text-sm text-slate-500">
            No partner lenders are available yet.
          </p>
        )}
        {lenders.map((lender) => (
          <div
            key={lender.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold uppercase text-brand-800">
                {String(lender.name || "?").slice(0, 2)}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{lender.name}</p>
                <p className="text-xs text-slate-500">
                  {lender.requestStatus
                    ? `Request ${lender.requestStatus}`
                    : "Partner lending organization"}
                </p>
              </div>
            </div>
            {lender.requestStatus === "pending" ? (
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800">
                Request sent
              </span>
            ) : lender.requestStatus === "accepted" ? (
              <span className="rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-800">
                Accepted
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRequest(lender.id)}
                disabled={requestingId === lender.id}
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestingId === lender.id
                  ? "Sending..."
                  : lender.requestStatus === "declined"
                    ? "Request again"
                    : "Send loan request"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BorrowerDashboardView({
  chatOpen,
  onOpenChat,
  onCloseChat,
  session,
  onLogout,
  consent,
  savingConsent,
  onToggleConsent,
  scoreData,
  message,
  messageIsError,
  lenders,
  lendersError,
  requestingId,
  onRequestLender,
  uploading,
  fileInputRef,
  onUpload,
  question,
  messages,
  loading,
  chatError,
  onQuestionChange,
  onAskCoach,
}) {
  if (chatOpen) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={onCloseChat}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-brand-400 hover:text-brand-700"
        >
          <span aria-hidden="true">←</span> Back to dashboard
        </button>
        <div className="mx-auto max-w-3xl">
          <Coach
            scoreData={scoreData}
            question={question}
            messages={messages}
            error={chatError}
            loading={loading}
            onQuestionChange={onQuestionChange}
            onSubmit={onAskCoach}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
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
              <span className="text-sm font-medium text-slate-600">
                Consent
              </span>
              <button
                type="button"
                onClick={onToggleConsent}
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
          {scoreData && (
            <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                Latest score
              </p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-3xl font-bold text-slate-900">
                  {scoreData.score}
                </span>
                <span className="text-sm text-slate-600">
                  {scoreData.riskLevel || "unknown risk"} ·{" "}
                  {scoreData.tier || "unassigned tier"}
                </span>
              </div>
            </div>
          )}
          {message && (
            <p
              className={`mt-4 text-sm ${messageIsError ? "text-red-600" : "text-green-700"}`}
            >
              {message}
            </p>
          )}
        </section>
        <LenderList
          lenders={lenders}
          error={lendersError}
          requestingId={requestingId}
          onRequest={onRequestLender}
        />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                AI borrower coach
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Open your score-grounded conversation in a dedicated workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenChat}
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Open chatbot
            </button>
          </div>
        </section>
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Quick actions
        </p>
        <div className="mt-4 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv"
            onChange={onUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Analyzing statement..." : "Upload statement"}
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-semibold text-slate-700"
          >
            View score
          </button>
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
