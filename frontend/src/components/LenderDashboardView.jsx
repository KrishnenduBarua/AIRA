import { Suspense, lazy } from "react";
import { API_URL } from "../api";
import { useLanguage } from "../i18n";
import {
  Alert,
  BackLink,
  Badge,
  Button,
  Card,
  CardHeader,
  DefinitionGrid,
  EmptyState,
  Page,
  ProgressBar,
  Skeleton,
  SkeletonList,
  SplitLayout,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";

const ChatPanel = lazy(() => import("./ChatPanel"));

const STATUS_TONES = {
  pending: "warning",
  accepted: "success",
  declined: "neutral",
};

const SEVERITY_TONES = { high: "danger", medium: "warning", low: "info" };

const SEASONALITY_TONES = {
  steady: "success",
  seasonal: "info",
  irregular: "warning",
  indeterminate: "neutral",
};

function statusLabel(t, status) {
  return t(`lender.filter${status.charAt(0).toUpperCase()}${status.slice(1)}`);
}

/* ------------------------------------------------------------------- inbox */

function RequestList({
  requests,
  totalRequests,
  state,
  pendingCount,
  error,
  onOpen,
  onRefresh,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  visibleCount,
  onShowMore,
}) {
  const { t } = useLanguage();
  const visible = requests.slice(0, visibleCount);
  const filtersActive = statusFilter !== "all" || Boolean(search.trim());

  return (
    <Card>
      <CardHeader
        eyebrow={t("lender.inbox")}
        description={t("lender.inboxHelp")}
        actions={
          <>
            {pendingCount > 0 && (
              <Badge tone="danger">
                {t("lender.newCount", { count: pendingCount })}
              </Badge>
            )}
            <Button
              variant="secondary"
              onClick={onRefresh}
              disabled={state === "refreshing"}
            >
              {state === "refreshing"
                ? t("common.loading")
                : t("common.refresh")}
            </Button>
          </>
        }
      />

      <div className="mt-4 space-y-3">
        <TextInput
          label={t("lender.searchPlaceholder")}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("lender.searchPlaceholder")}
        />
        <div
          role="group"
          aria-label={t("lender.filterAll")}
          className="flex flex-wrap gap-2"
        >
          {["all", "pending", "accepted", "declined"].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={statusFilter === option}
              onClick={() => onStatusFilterChange(option)}
              className={cx(
                "min-h-9 rounded-full border px-3 text-xs font-semibold transition",
                statusFilter === option
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50",
              )}
            >
              {statusLabel(t, option)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert
          variant="error"
          className="mt-4"
          action={
            <Button variant="secondary" onClick={onRefresh}>
              {t("common.retry")}
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <div className="mt-4">
        {state === "loading" ? (
          <SkeletonList rows={3} label={t("common.loading")} />
        ) : totalRequests === 0 ? (
          <EmptyState
            title={t("lender.empty")}
            description={t("lender.emptyHelp")}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            title={t("lender.noMatches")}
            action={
              filtersActive ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    onStatusFilterChange("all");
                    onSearchChange("");
                  }}
                >
                  {t("lender.clearFilters")}
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {t("lender.showingCount", {
                shown: visible.length,
                total: requests.length,
              })}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {visible.map((item) => (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50 sm:p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 break-words font-semibold text-slate-900">
                        {item.borrowerName}
                      </p>
                      <Badge tone={STATUS_TONES[item.status] || "neutral"}>
                        {statusLabel(t, item.status)}
                      </Badge>
                    </div>
                    <p className="break-words text-xs text-slate-600">
                      {item.borrowerPhone}
                    </p>
                    <Badge
                      tone={item.borrowerNidVerified ? "success" : "warning"}
                    >
                      {item.borrowerNidVerified
                        ? t("common.verified")
                        : t("common.pending")}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
            {visible.length < requests.length && (
              <Button variant="secondary" full className="mt-3" onClick={onShowMore}>
                {t("lender.loadMore")}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- score view */

function ScoreDetail({ score, insights }) {
  const { t } = useLanguage();

  if (!score) {
    return (
      <EmptyState icon="—" title={t("lender.noScore")} />
    );
  }

  const factors = insights?.factors || score.describedFactors || [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <span className="text-3xl font-bold text-slate-900">
            {t("lender.scoreOf", { score: score.score })}
          </span>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">
              {t("lender.riskLevel")}: {String(score.riskLevel || "—").replace(/_/g, " ")}
            </Badge>
            <Badge tone="brand">
              {t("lender.tier")}: {score.tier || "—"}
            </Badge>
          </div>
        </div>
      </div>

      {factors.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {t("lender.factors")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {t("lender.factorsHelp")}
          </p>
          <ul className="mt-3 space-y-2">
            {factors.map((factor) => {
              const magnitude = Math.min(1, Math.abs(factor.value) / 1.5);
              return (
                <li
                  key={factor.key}
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                >
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words text-xs font-medium text-slate-800">
                      {factor.label}
                    </span>
                    <span
                      className={cx(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        factor.direction === "supporting"
                          ? "text-green-700"
                          : "text-red-700",
                      )}
                    >
                      {factor.direction === "supporting"
                        ? t("lender.supporting")
                        : t("lender.reducing")}{" "}
                      {factor.value.toFixed(3)}
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200"
                  >
                    <span
                      className={cx(
                        "h-full rounded-full",
                        factor.direction === "supporting"
                          ? "bg-green-500"
                          : "bg-red-400",
                      )}
                      style={{ width: `${Math.max(4, magnitude * 100)}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function InsightsCard({ insights }) {
  const { t } = useLanguage();
  if (!insights) return null;

  const { seasonality, anomalies, history } = insights;

  return (
    <Card>
      <CardHeader eyebrow={t("lender.seasonality")} />
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Badge tone={SEASONALITY_TONES[seasonality.pattern] || "neutral"}>
          {seasonality.pattern}
        </Badge>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {seasonality.summary}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-900">
          {t("lender.history")}
        </p>
        <div className="mt-2">
          <ProgressBar
            value={history.progress}
            tone={history.sufficientForSixMonths ? "brand" : "warning"}
            label={`${history.monthsOfHistory}/${history.targetMonths} months · ${history.transactionCount} transactions`}
          />
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-900">
          {t("lender.anomalies")}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {t("lender.anomaliesHelp")}
        </p>
        {anomalies.length === 0 ? (
          <Alert variant="success" className="mt-3">
            {t("lender.noAnomalies")}
          </Alert>
        ) : (
          <ul className="mt-3 space-y-2">
            {anomalies.map((anomaly) => (
              <li
                key={anomaly.code}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"
              >
                <Badge tone={SEVERITY_TONES[anomaly.severity]}>
                  {t(`lender.severity.${anomaly.severity}`)}
                </Badge>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {anomaly.summary}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Statements({ detail }) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader eyebrow={t("lender.statements")} />
      {detail.statements.length === 0 ? (
        <div className="mt-3">
          <EmptyState title={t("lender.noStatements")} />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {detail.statements.map((statement) => (
            <li
              key={statement.id}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-slate-900">
                  {statement.filename}
                </p>
                <Badge
                  tone={statement.verified ? "success" : "warning"}
                  className="mt-1.5"
                >
                  {statement.verified
                    ? t("common.verified")
                    : t("common.pending")}
                </Badge>
              </div>
              <a
                href={`${API_URL}/loans/requests/${detail.request.id}/statements/${statement.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:border-brand-400 hover:bg-brand-50"
              >
                {t("lender.viewStatement")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- decision */

function DecisionCard({
  detail,
  draft,
  onDraftChange,
  reason,
  onReasonChange,
  error,
  deciding,
  onSubmit,
}) {
  const { t } = useLanguage();
  const status = detail.request.status;

  if (status !== "pending") {
    return (
      <Card>
        <CardHeader eyebrow={t("lender.decision")} />
        <Alert
          variant={status === "accepted" ? "success" : "info"}
          className="mt-3"
          title={t("lender.decided", { status: statusLabel(t, status) })}
        >
          {detail.request.decisionReason && (
            <p className="break-words">
              {t("lender.decidedReason", {
                reason: detail.request.decisionReason,
              })}
            </p>
          )}
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        eyebrow={t("lender.decision")}
        description={t("lender.decisionHelp")}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          variant={draft === "accepted" ? "primary" : "secondary"}
          aria-pressed={draft === "accepted"}
          onClick={() => onDraftChange("accepted")}
          disabled={deciding}
        >
          {t("lender.accept")}
        </Button>
        <Button
          variant={draft === "declined" ? "danger" : "secondary"}
          aria-pressed={draft === "declined"}
          onClick={() => onDraftChange("declined")}
          disabled={deciding}
        >
          {t("lender.decline")}
        </Button>
      </div>

      {draft && (
        <div className="mt-4 space-y-3">
          <TextArea
            required
            rows={4}
            label={t("lender.reasonLabel")}
            help={t("lender.reasonHelp")}
            placeholder={t("lender.reasonPlaceholder")}
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            error={error}
            disabled={deciding}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="sm:flex-1"
              variant={draft === "accepted" ? "primary" : "danger"}
              onClick={onSubmit}
              disabled={deciding || reason.trim().length < 10}
            >
              {deciding
                ? t("lender.submitting")
                : draft === "accepted"
                  ? t("lender.confirmAccept")
                  : t("lender.confirmDecline")}
            </Button>
            <Button
              variant="subtle"
              className="sm:flex-1"
              onClick={() => onDraftChange(null)}
              disabled={deciding}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ review screen */

function ReviewScreen({
  detail,
  detailLoading,
  detailError,
  onBack,
  onRetryDetail,
  decisionDraft,
  onDecisionDraftChange,
  decisionReason,
  onDecisionReasonChange,
  decisionError,
  deciding,
  onSubmitDecision,
  chatProps,
}) {
  const { t } = useLanguage();

  return (
    <Page>
      <BackLink onClick={onBack}>{t("common.backToDashboard")}</BackLink>

      {detailError && (
        <Alert
          variant="error"
          title={t("errors.loadProfile")}
          action={
            <Button variant="secondary" onClick={onRetryDetail}>
              {t("common.retry")}
            </Button>
          }
        >
          {detailError}
        </Alert>
      )}

      {detailLoading ? (
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </Card>
      ) : detail ? (
        <SplitLayout
          main={
            <>
              <Card>
                <CardHeader
                  eyebrow={t("lender.profile")}
                  title={detail.borrower.name}
                  actions={
                    <Badge tone={STATUS_TONES[detail.request.status]}>
                      {statusLabel(t, detail.request.status)}
                    </Badge>
                  }
                />
                <div className="mt-4">
                  <DefinitionGrid
                    items={[
                      { label: t("common.phone"), value: detail.borrower.phone },
                      {
                        label: t("auth.nidNumber"),
                        value: detail.borrower.nidNumber,
                      },
                      {
                        label: t("auth.dob"),
                        value: detail.borrower.dateOfBirth,
                      },
                      {
                        label: t("auth.steps.identity"),
                        value: detail.borrower.nidVerified
                          ? t("common.verified")
                          : t("common.pending"),
                      },
                      {
                        label: t("auth.address"),
                        value: detail.borrower.permanentAddress,
                      },
                    ]}
                  />
                </div>
              </Card>

              <Card>
                <CardHeader eyebrow={t("lender.trustScore")} />
                <Alert variant="warning" className="mt-3">
                  {t("lender.aiLabel")}
                </Alert>
                <div className="mt-4">
                  <ScoreDetail
                    score={detail.score}
                    insights={detail.insights}
                  />
                </div>
              </Card>

              <InsightsCard insights={detail.insights} />
              <Statements detail={detail} />
            </>
          }
          aside={
            <>
              <DecisionCard
                detail={detail}
                draft={decisionDraft}
                onDraftChange={onDecisionDraftChange}
                reason={decisionReason}
                onReasonChange={onDecisionReasonChange}
                error={decisionError}
                deciding={deciding}
                onSubmit={onSubmitDecision}
              />
              <Suspense
                fallback={
                  <Card>
                    <Skeleton className="h-40 w-full" />
                  </Card>
                }
              >
                <ChatPanel mode="lender" {...chatProps} />
              </Suspense>
            </>
          }
        />
      ) : null}
    </Page>
  );
}

/* -------------------------------------------------------------------- view */

export default function LenderDashboardView({
  session,
  onLogout,
  requests,
  totalRequests,
  requestsState,
  pendingCount,
  requestError,
  onRefreshRequests,
  onOpenRequest,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  visibleCount,
  onShowMore,
  borrowerId,
  onBorrowerIdChange,
  loadingScore,
  scoreError,
  scoreData,
  onLoadScore,
  selectedRequest,
  requestDetail,
  detailLoading,
  detailError,
  onBack,
  onRetryDetail,
  decisionDraft,
  onDecisionDraftChange,
  decisionReason,
  onDecisionReasonChange,
  decisionError,
  deciding,
  onSubmitDecision,
  question,
  messages,
  chatError,
  chatLoading,
  chatHistoryLoading,
  chatGrounding,
  onQuestionChange,
  onAskCoach,
  onRetryChat,
}) {
  const { t } = useLanguage();

  const chatProps = {
    available: Boolean(scoreData),
    question,
    messages,
    loading: chatLoading,
    historyLoading: chatHistoryLoading,
    error: chatError,
    grounding: chatGrounding,
    onQuestionChange,
    onSubmit: onAskCoach,
    onRetry: onRetryChat,
  };

  if (selectedRequest) {
    return (
      <ReviewScreen
        detail={requestDetail}
        detailLoading={detailLoading}
        detailError={detailError}
        onBack={onBack}
        onRetryDetail={onRetryDetail}
        decisionDraft={decisionDraft}
        onDecisionDraftChange={onDecisionDraftChange}
        decisionReason={decisionReason}
        onDecisionReasonChange={onDecisionReasonChange}
        decisionError={decisionError}
        deciding={deciding}
        onSubmitDecision={onSubmitDecision}
        chatProps={chatProps}
      />
    );
  }

  return (
    <Page>
      <Card>
        <CardHeader
          eyebrow={t("lender.workspace")}
          title={t("lender.welcome", { name: session.user.name })}
          description={t("lender.subtitle")}
          actions={
            <Button variant="secondary" onClick={onLogout}>
              {t("common.logout")}
            </Button>
          }
        />
      </Card>

      <SplitLayout
        main={
          <RequestList
            requests={requests}
            totalRequests={totalRequests}
            state={requestsState}
            pendingCount={pendingCount}
            error={requestError}
            onOpen={onOpenRequest}
            onRefresh={onRefreshRequests}
            statusFilter={statusFilter}
            onStatusFilterChange={onStatusFilterChange}
            search={search}
            onSearchChange={onSearchChange}
            visibleCount={visibleCount}
            onShowMore={onShowMore}
          />
        }
        aside={
          <Card>
            <CardHeader
              eyebrow={t("lender.lookup")}
              description={t("lender.lookupHelp")}
            />
            <div className="mt-4 space-y-3">
              <TextInput
                label={t("lender.lookupPlaceholder")}
                value={borrowerId}
                onChange={(event) => onBorrowerIdChange(event.target.value)}
                placeholder={t("lender.lookupPlaceholder")}
              />
              <Button
                full
                onClick={onLoadScore}
                disabled={loadingScore || !borrowerId.trim()}
              >
                {loadingScore ? t("common.loading") : t("lender.loadScore")}
              </Button>
            </div>

            {scoreError && (
              <Alert variant="error" className="mt-4">
                {scoreError}
              </Alert>
            )}

            {scoreData && (
              <div className="mt-4">
                <Alert variant="warning" className="mb-3">
                  {t("lender.aiLabel")}
                </Alert>
                <ScoreDetail score={scoreData} insights={null} />
              </div>
            )}
          </Card>
        }
      />
    </Page>
  );
}
