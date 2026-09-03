import { useState } from "react";
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
  HeaderSlot,
  Page,
  ProgressBar,
  Skeleton,
  SkeletonList,
  SplitLayout,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";
import ChatWidget from "./ChatWidget";

const STATUS_TONES = {
  pending: "warning",
  accepted: "success",
  declined: "neutral",
};

const SEVERITY_TONES = { high: "danger", medium: "warning", low: "info" };
const FRAUD_REVIEW_TONES = {
  pending: "danger",
  reviewing: "warning",
  cleared: "success",
  confirmed: "danger",
};

const SEASONALITY_TONES = {
  steady: "success",
  seasonal: "info",
  irregular: "warning",
  indeterminate: "neutral",
};

// The analysis columns run long — a full SHAP list, anomalies, statements —
// while the decision column beside them is short. Collapsing the detail keeps
// the two sides closer in height, and lets a reviewer open only what they need.
function CollapseToggle({ open, onToggle, controls }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      className="aira-collapse-toggle"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      {open ? t("common.collapse") : t("common.expand")}
      <span aria-hidden="true">{open ? "▾" : "▸"}</span>
    </button>
  );
}

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
    <Card className="lender-inbox-card">
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
                    className="lender-request-card flex w-full min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50 sm:p-4"
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
                    <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <Badge
                        tone={item.borrowerNidVerified ? "success" : "warning"}
                      >
                        {item.borrowerNidVerified
                          ? t("common.verified")
                          : t("common.pending")}
                      </Badge>
                      <span className="aira-details-cta">
                        {t("common.showDetails")}
                        <span aria-hidden="true">›</span>
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {visible.length < requests.length && (
              <Button
                variant="secondary"
                full
                className="mt-3"
                onClick={onShowMore}
              >
                {t("lender.loadMore")}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// The workspace navigation lives inside the shared app header, so a lender
// never sees two stacked bars saying the same thing.
function LenderNavbar({
  activeSection,
  onSectionChange,
  pendingCount,
  fraudCount,
  onLogout,
}) {
  const { t } = useLanguage();
  const items = [
    {
      id: "overview",
      label: t("lender.navOverview"),
      icon: "⌂",
      count: pendingCount,
    },
    { id: "fraud", label: t("lender.navFraud"), icon: "!", count: fraudCount },
  ];

  return (
    <>
      <HeaderSlot id="aira-header-nav">
        <nav className="lender-navbar-nav" aria-label={t("lender.navigation")}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(
                "lender-navbar-link",
                activeSection === item.id && "is-active",
              )}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => onSectionChange(item.id)}
            >
              <span className="lender-navbar-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.count > 0 && (
                <span className="lender-navbar-count">{item.count}</span>
              )}
            </button>
          ))}
        </nav>
      </HeaderSlot>
      <HeaderSlot id="aira-header-actions">
        <button
          type="button"
          className="lender-navbar-logout"
          onClick={onLogout}
        >
          ↗ <span>{t("common.logout")}</span>
        </button>
      </HeaderSlot>
    </>
  );
}

function LenderWorkspace({
  children,
  activeSection,
  onSectionChange,
  pendingCount,
  fraudCount,
  onLogout,
}) {
  return (
    <div className="lender-workspace-shell">
      <LenderNavbar
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        pendingCount={pendingCount}
        fraudCount={fraudCount}
        onLogout={onLogout}
      />
      <div className="lender-workspace-content">{children}</div>
    </div>
  );
}

function FraudReferralList({ requests, onOpen }) {
  const { t } = useLanguage();

  return (
    <Card className="lender-fraud-queue-card">
      <CardHeader
        eyebrow={t("lender.fraudReview")}
        title={t("lender.fraudQueueTitle")}
        description={t("lender.fraudQueueHelp")}
      />
      {requests.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t("lender.noFraudReferrals")} />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {requests.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="lender-referral-row"
              >
                <span className="min-w-0">
                  <span className="block break-words font-semibold text-slate-900">
                    {item.borrowerName}
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {item.borrowerPhone}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge
                    tone={
                      FRAUD_REVIEW_TONES[item.fraudReview?.status] || "neutral"
                    }
                  >
                    {item.fraudReview
                      ? t(`lender.fraudStatus.${item.fraudReview.status}`)
                      : t("lender.notReferred")}
                  </Badge>
                  <span className="aira-details-cta">
                    {t("common.showDetails")}
                    <span aria-hidden="true">›</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- score view */

const TOP_FACTORS = 4;

function ScoreDetail({ score, insights }) {
  const { t } = useLanguage();
  const [allFactors, setAllFactors] = useState(false);

  if (!score) {
    return <EmptyState icon="—" title={t("lender.noScore")} />;
  }

  const factors = insights?.factors || score.describedFactors || [];
  const visibleFactors = allFactors ? factors : factors.slice(0, TOP_FACTORS);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <span className="text-3xl font-bold text-slate-900">
            {t("lender.scoreOf", { score: score.score })}
          </span>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">
              {t("lender.riskLevel")}:{" "}
              {String(score.riskLevel || "—").replace(/_/g, " ")}
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
            {visibleFactors.map((factor) => {
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
          {factors.length > TOP_FACTORS && (
            <Button
              variant="subtle"
              full
              className="mt-3"
              aria-expanded={allFactors}
              onClick={() => setAllFactors((open) => !open)}
            >
              {allFactors
                ? t("lender.showTopFactors")
                : t("lender.showAllFactors", { count: factors.length })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function InsightsCard({ insights }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  if (!insights) return null;

  const { seasonality, anomalies, history } = insights;

  return (
    <Card>
      <CardHeader
        eyebrow={t("lender.seasonality")}
        actions={
          <CollapseToggle
            open={open}
            onToggle={() => setOpen((value) => !value)}
            controls="lender-insights-body"
          />
        }
      />
      <div id="lender-insights-body" hidden={!open}>
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
      </div>
    </Card>
  );
}

function Statements({ detail }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardHeader
        eyebrow={t("lender.statements")}
        actions={
          <CollapseToggle
            open={open}
            onToggle={() => setOpen((value) => !value)}
            controls="lender-statements-body"
          />
        }
      />
      <div id="lender-statements-body" hidden={!open}>
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
      </div>
    </Card>
  );
}

function BlockchainVerification({ detail, state, error, onVerify }) {
  const anchor = detail.score?.blockchain;

  return (
    <Card>
      <CardHeader
        eyebrow="Blockchain verification"
        description="Confirm that this score hash is recorded on Polygon Amoy."
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={anchor?.status === "confirmed" ? "success" : "neutral"}>
          {state === "loading"
            ? "Checking..."
            : anchor?.status || "Not anchored"}
        </Badge>
        <Button
          variant="secondary"
          onClick={onVerify}
          disabled={state === "loading" || !anchor?.scoreHash}
        >
          {state === "loading" ? "Checking..." : "Verify on blockchain"}
        </Button>
        {anchor?.explorerUrl && (
          <a
            href={anchor.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            View on PolygonScan
          </a>
        )}
      </div>
      {anchor?.scoreHash && (
        <p className="mt-3 break-all text-xs text-slate-500">
          Score hash: {anchor.scoreHash}
        </p>
      )}
      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
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

function FraudReviewCard({
  detail,
  reason,
  onReasonChange,
  error,
  submitting,
  onSubmit,
}) {
  const { t } = useLanguage();
  const review = detail.fraudReview;

  if (review) {
    return (
      <Card>
        <CardHeader
          eyebrow={t("lender.fraudReview")}
          actions={
            <Badge tone={FRAUD_REVIEW_TONES[review.status] || "neutral"}>
              {t(`lender.fraudStatus.${review.status}`)}
            </Badge>
          }
        />
        <Alert
          variant={review.status === "cleared" ? "success" : "warning"}
          className="mt-3"
          title={t(`lender.fraudStatus.${review.status}`)}
        >
          <p>{review.reason}</p>
          {review.adminNotes && (
            <p className="mt-2 text-xs">
              {t("lender.adminNote")}: {review.adminNotes}
            </p>
          )}
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        eyebrow={t("lender.fraudReview")}
        description={t("lender.fraudReviewHelp")}
      />
      <TextArea
        required
        rows={4}
        className="mt-4"
        label={t("lender.fraudReasonLabel")}
        help={t("lender.fraudReasonHelp")}
        placeholder={t("lender.fraudReasonPlaceholder")}
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        error={error}
        disabled={submitting}
      />
      <Button
        full
        variant="danger"
        className="mt-3"
        onClick={onSubmit}
        disabled={submitting || reason.trim().length < 10}
      >
        {submitting ? t("lender.fraudSubmitting") : t("lender.sendFraudReview")}
      </Button>
    </Card>
  );
}

function ReviewChecklist() {
  const { t } = useLanguage();
  const items = [
    t("lender.checkNameMatch"),
    t("lender.checkPhoneMatch"),
    t("lender.checkStatements"),
    t("lender.checkAnomalies"),
  ];

  return (
    <Card className="lender-checklist-card">
      <CardHeader
        eyebrow={t("lender.checklist")}
        description={t("lender.checklistHelp")}
      />
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <label key={item} className="lender-checklist-item">
            <input type="checkbox" />
            <span>{item}</span>
          </label>
        ))}
      </div>
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
  chatOpen,
  onOpenChat,
  onCloseChat,
  blockchainState,
  blockchainError,
  onVerifyBlockchain,
}) {
  const { t } = useLanguage();

  return (
    <Page className="dashboard-page lender-review-page">
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
        <>
          <SplitLayout
            className="lender-review-layout"
            main={
              <>
                <Card className="review-profile-card">
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
                        {
                          label: t("common.phone"),
                          value: detail.borrower.phone,
                        },
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

                <Card className="review-score-card">
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
                <BlockchainVerification
                  detail={detail}
                  state={blockchainState}
                  error={blockchainError}
                  onVerify={onVerifyBlockchain}
                />
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
                <ReviewChecklist />
                <Statements detail={detail} />
              </>
            }
          />
          <ChatWidget
            open={chatOpen}
            onOpen={onOpenChat}
            onClose={onCloseChat}
            mode="lender"
            {...chatProps}
          />
        </>
      ) : null}
    </Page>
  );
}

function FraudReviewScreen({
  detail,
  detailLoading,
  detailError,
  onBack,
  onRetryDetail,
  fraudReason,
  onFraudReasonChange,
  fraudError,
  fraudSubmitting,
  onSubmitFraudReview,
}) {
  const { t } = useLanguage();

  return (
    <Page className="dashboard-page lender-review-page lender-fraud-page">
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
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : detail ? (
        <>
          <Card className="review-profile-card">
            <CardHeader
              eyebrow={t("lender.fraudReview")}
              title={detail.borrower.name}
              description={t("lender.fraudPageHelp")}
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
                    label: t("auth.steps.identity"),
                    value: detail.borrower.nidVerified
                      ? t("common.verified")
                      : t("common.pending"),
                  },
                ]}
              />
            </div>
          </Card>
          <div className="lender-fraud-only-grid">
            <Card className="review-score-card">
              <CardHeader eyebrow={t("lender.trustScore")} />
              <div className="mt-4">
                <ScoreDetail score={detail.score} insights={null} />
              </div>
            </Card>
            <div className="lender-fraud-action-stack">
              <FraudReviewCard
                detail={detail}
                reason={fraudReason}
                onReasonChange={onFraudReasonChange}
                error={fraudError}
                submitting={fraudSubmitting}
                onSubmit={onSubmitFraudReview}
              />
            </div>
          </div>
        </>
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
  acceptedCount,
  declinedCount,
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
  fraudReason,
  onFraudReasonChange,
  fraudError,
  fraudSubmitting,
  onSubmitFraudReview,
  chatOpen,
  onOpenChat,
  onCloseChat,
  question,
  messages,
  chatError,
  chatLoading,
  chatHistoryLoading,
  chatGrounding,
  onQuestionChange,
  onAskCoach,
  onRetryChat,
  activeSection,
  onSectionChange,
  reviewMode,
  onOpenFraudRequest,
  blockchainState,
  blockchainError,
  onVerifyBlockchain,
}) {
  const { t } = useLanguage();
  const fraudCount = requests.filter((item) => item.fraudReview).length;

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
      <LenderWorkspace
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        pendingCount={pendingCount}
        fraudCount={fraudCount}
        onLogout={onLogout}
      >
        {reviewMode === "fraud" ? (
          <FraudReviewScreen
            detail={requestDetail}
            detailLoading={detailLoading}
            detailError={detailError}
            onBack={onBack}
            onRetryDetail={onRetryDetail}
            fraudReason={fraudReason}
            onFraudReasonChange={onFraudReasonChange}
            fraudError={fraudError}
            fraudSubmitting={fraudSubmitting}
            onSubmitFraudReview={onSubmitFraudReview}
          />
        ) : (
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
            chatOpen={chatOpen}
            onOpenChat={onOpenChat}
            onCloseChat={onCloseChat}
            blockchainState={blockchainState}
            blockchainError={blockchainError}
            onVerifyBlockchain={onVerifyBlockchain}
          />
        )}
      </LenderWorkspace>
    );
  }

  return (
    <LenderWorkspace
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      pendingCount={pendingCount}
      fraudCount={fraudCount}
      onLogout={onLogout}
    >
      <Page className="dashboard-page lender-page">
        <Card className="dashboard-hero lender-hero">
          <CardHeader
            eyebrow={t(`lender.section.${activeSection}`)}
            title={t("lender.welcome", { name: session.user.name })}
            description={t("lender.subtitle")}
          />
        </Card>

        {activeSection === "overview" && (
          <>
            <div
              className="dashboard-summary lender-summary"
              aria-label={t("lender.inbox")}
            >
              <Card as="article" className="dashboard-stat">
                <span className="dashboard-stat-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <p className="dashboard-stat-label">
                    {t("lender.filterPending")}
                  </p>
                  <p className="dashboard-stat-value">{pendingCount}</p>
                </div>
              </Card>
              <Card as="article" className="dashboard-stat">
                <span className="dashboard-stat-icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <p className="dashboard-stat-label">
                    {t("lender.filterAccepted")}
                  </p>
                  <p className="dashboard-stat-value">{acceptedCount}</p>
                </div>
              </Card>
              <Card as="article" className="dashboard-stat">
                <span className="dashboard-stat-icon" aria-hidden="true">
                  —
                </span>
                <div>
                  <p className="dashboard-stat-label">
                    {t("lender.filterDeclined")}
                  </p>
                  <p className="dashboard-stat-value">{declinedCount}</p>
                </div>
              </Card>
              <Card
                as="article"
                className="dashboard-stat dashboard-stat-total"
              >
                <span className="dashboard-stat-icon" aria-hidden="true">
                  #
                </span>
                <div>
                  <p className="dashboard-stat-label">
                    {t("lender.filterAll")}
                  </p>
                  <p className="dashboard-stat-value">{totalRequests}</p>
                </div>
              </Card>
            </div>
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
          </>
        )}

        {activeSection === "fraud" && (
          <FraudReferralList requests={requests} onOpen={onOpenFraudRequest} />
        )}
      </Page>
    </LenderWorkspace>
  );
}
