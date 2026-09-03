import { Suspense, lazy } from "react";
import { useLanguage } from "../i18n";
import {
  Alert,
  Badge,
  BackLink,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Page,
  ProgressBar,
  Skeleton,
  SkeletonList,
  cx,
} from "../ui/primitives";

const ChatPanel = lazy(() => import("./ChatPanel"));

const LEVEL_TONES = {
  strong: "success",
  building: "warning",
  attention: "danger",
};

const LEVEL_BARS = {
  strong: "bg-green-500",
  building: "bg-amber-500",
  attention: "bg-red-400",
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value, language) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ consent */

function ConsentCard({ consent, saving, error, onToggle }) {
  const { t } = useLanguage();
  const shared = t("consent.shared");
  const notShared = t("consent.notShared");

  return (
    <Card>
      <CardHeader
        eyebrow={t("consent.title")}
        description={t("consent.lead")}
        actions={
          <Badge tone={consent ? "success" : "neutral"}>
            {consent ? t("consent.granted") : t("consent.notGranted")}
          </Badge>
        }
      />

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-brand-100 bg-brand-50 p-3">
          <p className="text-sm font-semibold text-brand-900">
            {t("consent.sharedTitle")}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
            {shared.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-brand-600">
                  ✓
                </span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">
            {t("consent.notSharedTitle")}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
            {notShared.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-slate-400">
                  ✕
                </span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {t("consent.withdrawNote")}
      </p>

      <Button
        full
        variant={consent ? "secondary" : "primary"}
        onClick={onToggle}
        disabled={saving}
        className="mt-4"
      >
        {saving
          ? t("common.saving")
          : consent
            ? t("consent.withdraw")
            : t("consent.grant")}
      </Button>
    </Card>
  );
}

/* -------------------------------------------------------------- trust tier */

function TierCard({ profile, state, error, onRetry, language }) {
  const { t } = useLanguage();

  if (state === "loading") {
    return (
      <Card>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card>
        <Alert
          variant="error"
          title={t("errors.generic")}
          action={
            <Button variant="secondary" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          }
        >
          {error}
        </Alert>
      </Card>
    );
  }

  if (!profile?.hasScore) {
    return (
      <Card>
        <CardHeader eyebrow={t("borrower.tierTitle")} />
        <div className="mt-4">
          <EmptyState
            icon="↑"
            title={t("borrower.noTierTitle")}
            description={t("borrower.noTierBody")}
          />
        </div>
      </Card>
    );
  }

  const tierLabel = t(`borrower.tiers.${profile.tier}`);
  const meaning = t(`borrower.tierMeaning.${profile.tier}`);

  return (
    <Card>
      <CardHeader
        eyebrow={t("borrower.tierTitle")}
        actions={
          profile.createdAt ? (
            <span className="text-xs text-slate-500">
              {t("borrower.lastUpdated", {
                date: formatDate(profile.createdAt, language),
              })}
            </span>
          ) : null
        }
      />

      <div className="mt-4 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-lg font-bold text-white"
          >
            {profile.tierLevel}
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-900">{tierLabel}</p>
            <p className="text-xs text-slate-600">
              {t("common.step")} {profile.tierLevel} {t("common.of")}{" "}
              {profile.tierSteps}
            </p>
          </div>
        </div>

        <div
          className="mt-4 flex gap-1.5"
          role="img"
          aria-label={`${tierLabel} — ${profile.tierLevel}/${profile.tierSteps}`}
        >
          {Array.from({ length: profile.tierSteps }).map((_, index) => (
            <span
              key={index}
              className={cx(
                "h-2 flex-1 rounded-full",
                index < profile.tierLevel ? "bg-brand-600" : "bg-brand-200",
              )}
            />
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-700">{meaning}</p>
      </div>

      <Alert variant="info" className="mt-4">
        {t("borrower.tierNote")}
      </Alert>
    </Card>
  );
}

/* -------------------------------------------------------------- categories */

function CategoriesCard({ profile }) {
  const { t } = useLanguage();
  const categories = profile?.categories || [];
  if (!categories.length) return null;

  const nextSteps = categories
    .filter((item) => item.level !== "strong")
    .slice(0, 3);

  return (
    <Card>
      <CardHeader
        eyebrow={t("borrower.categories")}
        description={t("borrower.categoriesHelp")}
      />

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <li
            key={category.key}
            className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-semibold text-slate-900">
                {t(`categories.${category.key}.title`)}
              </p>
              <Badge tone={LEVEL_TONES[category.level]}>
                {t(`categories.levels.${category.level}`)}
              </Badge>
            </div>
            <span
              aria-hidden="true"
              className="mt-2 flex h-1.5 gap-1 overflow-hidden rounded-full"
            >
              {["attention", "building", "strong"].map((step, index) => (
                <span
                  key={step}
                  className={cx(
                    "h-full flex-1 rounded-full",
                    index <=
                      ["attention", "building", "strong"].indexOf(category.level)
                      ? LEVEL_BARS[category.level]
                      : "bg-slate-200",
                  )}
                />
              ))}
            </span>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {t(`categories.${category.key}.${category.level}`)}
            </p>
          </li>
        ))}
      </ul>

      {nextSteps.length > 0 && (
        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-3">
          <p className="text-sm font-semibold text-brand-900">
            {t("borrower.nextSteps")}
          </p>
          <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {nextSteps.map((category, index) => (
              <li key={category.key} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[0.7rem] font-bold text-white"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  {t(`categories.${category.key}.tip`)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- history */

function HistoryCard({ profile }) {
  const { t } = useLanguage();
  const history = profile?.history;
  if (!history || !profile?.hasStatement) return null;

  const sufficient = history.sufficientForSixMonths;

  return (
    <Card>
      <CardHeader eyebrow={t("borrower.historyTitle")} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="neutral">
          {t("borrower.historyMonths", { months: history.monthsOfHistory })}
        </Badge>
        <Badge tone="neutral">
          {t("borrower.historyTransactions", {
            count: history.transactionCount,
          })}
        </Badge>
      </div>
      <div className="mt-4">
        <ProgressBar
          value={history.progress}
          tone={sufficient ? "brand" : "warning"}
          label={t("borrower.historyProgress", {
            months: history.monthsOfHistory,
            target: history.targetMonths,
          })}
        />
      </div>
      <Alert variant={sufficient ? "success" : "warning"} className="mt-4">
        {t(sufficient ? "borrower.historyGood" : "borrower.historyShort", {
          months: history.monthsOfHistory,
          target: history.targetMonths,
        })}
      </Alert>
    </Card>
  );
}

/* ------------------------------------------------------------------ upload */

const UPLOAD_STEPS = ["upload", "verify", "extract", "score"];

function UploadCard({
  consent,
  fileInputRef,
  selectedFile,
  onChooseFile,
  onClearFile,
  onStartUpload,
  onResetUpload,
  phase,
  progress,
  error,
  result,
}) {
  const { t } = useLanguage();
  const active = UPLOAD_STEPS.includes(phase);
  const activeIndex = UPLOAD_STEPS.indexOf(phase);

  return (
    <Card>
      <CardHeader eyebrow={t("upload.title")} description={t("upload.help")} />

      {!consent && (
        <Alert variant="warning" className="mt-4">
          {t("consent.requiredForUpload")}
        </Alert>
      )}

      <ul className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <li className="rounded-lg bg-slate-100 px-2.5 py-1.5">
          {t("upload.supported")}
        </li>
        <li className="rounded-lg bg-slate-100 px-2.5 py-1.5">
          {t("upload.sizeLimit")}
        </li>
      </ul>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {t("upload.sourceHelp")}
      </p>

      <div className="mt-4">
        <Field label={t("upload.chooseFile")}>
          {(props) => (
            <input
              {...props}
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              onChange={onChooseFile}
              disabled={active}
              className={cx(
                props.className,
                "file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-800",
              )}
            />
          )}
        </Field>
      </div>

      {selectedFile && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="min-w-0 flex-1 break-all text-sm text-slate-700">
            {t("upload.selected", {
              name: selectedFile.name,
              size: formatBytes(selectedFile.size),
            })}
          </p>
          {!active && (
            <Button variant="subtle" onClick={onClearFile}>
              {t("common.close")}
            </Button>
          )}
        </div>
      )}

      {error && (
        <Alert
          variant="error"
          className="mt-4"
          action={
            selectedFile ? (
              <Button variant="secondary" onClick={onStartUpload}>
                {t("upload.retry")}
              </Button>
            ) : null
          }
        >
          <p>{error}</p>
          {selectedFile && (
            <p className="mt-1 text-xs">{t("upload.keepFile")}</p>
          )}
        </Alert>
      )}

      {active && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <ol className="space-y-2" aria-label={t("upload.title")}>
            {UPLOAD_STEPS.map((step, index) => {
              const state =
                index < activeIndex
                  ? "done"
                  : index === activeIndex
                    ? "active"
                    : "pending";
              return (
                <li
                  key={step}
                  aria-current={state === "active" ? "step" : undefined}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      state === "done" && "bg-brand-600 text-white",
                      state === "active" &&
                        "bg-brand-700 text-white motion-safe:animate-pulse",
                      state === "pending" && "bg-slate-200 text-slate-500",
                    )}
                  >
                    {state === "done" ? "✓" : index + 1}
                  </span>
                  <span
                    className={cx(
                      "min-w-0 flex-1",
                      state === "pending" ? "text-slate-500" : "text-slate-800",
                    )}
                  >
                    {t(`upload.steps.${step}`)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {t(
                      state === "done"
                        ? "upload.stepDone"
                        : state === "active"
                          ? "upload.stepActive"
                          : "upload.stepPending",
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {phase === "upload" && (
            <ProgressBar value={progress} label={t("upload.steps.upload")} />
          )}
          <p className="text-xs leading-5 text-slate-500">
            {t("upload.slowNote")}
          </p>
        </div>
      )}

      {phase === "done" && result && (
        <Alert
          variant="success"
          title={t("upload.success")}
          className="mt-4"
          action={
            <Button variant="secondary" onClick={onResetUpload}>
              {t("common.close")}
            </Button>
          }
        >
          {result.history && (
            <p>
              {t("upload.foundSummary", {
                count: result.history.transactionCount,
                months: result.history.monthsOfHistory,
              })}
            </p>
          )}
        </Alert>
      )}

      <Button
        full
        className="mt-4"
        onClick={onStartUpload}
        disabled={!selectedFile || !consent || active}
      >
        {active ? t(`upload.steps.${phase}`) : t("upload.start")}
      </Button>
    </Card>
  );
}

/* ----------------------------------------------------------------- lenders */

function LenderCard({ lender, requesting, onRequest, canApply, language }) {
  const { t } = useLanguage();
  const status = lender.requestStatus;

  const tone =
    status === "accepted"
      ? "success"
      : status === "pending"
        ? "warning"
        : status === "declined"
          ? "neutral"
          : "brand";

  return (
    <li className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold uppercase text-brand-800"
        >
          {String(lender.name || "?").slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-slate-900">
            {lender.name}
          </p>
          {lender.joinedAt && (
            <p className="mt-0.5 text-xs text-slate-500">
              {t("lenders.joined", {
                date: formatDate(lender.joinedAt, language),
              })}
            </p>
          )}
          {status && (
            <div className="mt-2">
              <Badge tone={tone}>
                {t(
                  `lenders.status${status.charAt(0).toUpperCase()}${status.slice(1)}`,
                )}
              </Badge>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">
                {t(
                  `lenders.status${status.charAt(0).toUpperCase()}${status.slice(1)}Help`,
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {status !== "pending" && status !== "accepted" && (
        <Button
          full
          className="mt-3"
          onClick={() => onRequest(lender.id)}
          disabled={requesting || !canApply}
        >
          {requesting
            ? t("lenders.sending")
            : status === "declined"
              ? t("lenders.applyAgain")
              : t("lenders.apply")}
        </Button>
      )}
    </li>
  );
}

function LenderList({
  lenders,
  state,
  error,
  requestingId,
  onRequest,
  onRefresh,
  canApply,
  language,
}) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader
        eyebrow={t("lenders.title")}
        description={t("lenders.subtitle")}
        actions={
          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={state === "refreshing"}
          >
            {state === "refreshing" ? t("common.loading") : t("common.refresh")}
          </Button>
        }
      />

      <Alert variant="info" className="mt-4">
        {t("lenders.approvalNote")}
      </Alert>

      {!canApply && (
        <Alert variant="warning" className="mt-3">
          {t("lenders.needProfile")}
        </Alert>
      )}

      {error && (
        <Alert
          variant="error"
          className="mt-3"
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
          <SkeletonList rows={2} label={t("common.loading")} />
        ) : lenders.length === 0 ? (
          <EmptyState
            title={t("lenders.empty")}
            description={t("lenders.emptyHelp")}
            action={
              <Button variant="secondary" onClick={onRefresh}>
                {t("common.refresh")}
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {t("lenders.count", { count: lenders.length })}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {lenders.map((lender) => (
                <LenderCard
                  key={lender.id}
                  lender={lender}
                  language={language}
                  canApply={canApply}
                  requesting={requestingId === lender.id}
                  onRequest={onRequest}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------- view */

export default function BorrowerDashboardView({
  session,
  onLogout,
  chatOpen,
  onOpenChat,
  onCloseChat,
  consent,
  consentError,
  savingConsent,
  onToggleConsent,
  profile,
  profileState,
  profileError,
  onRetryProfile,
  lenders,
  lendersState,
  lendersError,
  requestingId,
  onRequestLender,
  onRefreshLenders,
  fileInputRef,
  selectedFile,
  onChooseFile,
  onClearFile,
  onStartUpload,
  onResetUpload,
  uploadPhase,
  uploadProgress,
  uploadError,
  uploadResult,
  question,
  messages,
  chatLoading,
  chatHistoryLoading,
  chatError,
  chatGrounding,
  onQuestionChange,
  onAskCoach,
  onRetryChat,
}) {
  const { t, language } = useLanguage();

  const chatFallback = (
    <Card>
      <Skeleton className="h-40 w-full" />
    </Card>
  );

  if (chatOpen) {
    return (
      <Page>
        <BackLink onClick={onCloseChat}>{t("common.backToDashboard")}</BackLink>
        <div className="mx-auto w-full max-w-3xl">
          <Suspense fallback={chatFallback}>
            <ChatPanel
              mode="borrower"
              available={Boolean(profile?.hasScore)}
              question={question}
              messages={messages}
              loading={chatLoading}
              historyLoading={chatHistoryLoading}
              error={chatError}
              grounding={chatGrounding}
              onQuestionChange={onQuestionChange}
              onSubmit={onAskCoach}
              onRetry={onRetryChat}
            />
          </Suspense>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <CardHeader
          eyebrow={t("app.borrower")}
          title={t("borrower.welcome", { name: session.user.name })}
          description={t("borrower.subtitle")}
          actions={
            <Button variant="secondary" onClick={onLogout}>
              {t("common.logout")}
            </Button>
          }
        />
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <TierCard
            profile={profile}
            state={profileState}
            error={profileError}
            onRetry={onRetryProfile}
            language={language}
          />
          <CategoriesCard profile={profile} />
          <HistoryCard profile={profile} />
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <ConsentCard
            consent={consent}
            saving={savingConsent}
            error={consentError}
            onToggle={onToggleConsent}
          />
          <UploadCard
            consent={consent}
            fileInputRef={fileInputRef}
            selectedFile={selectedFile}
            onChooseFile={onChooseFile}
            onClearFile={onClearFile}
            onStartUpload={onStartUpload}
            onResetUpload={onResetUpload}
            phase={uploadPhase}
            progress={uploadProgress}
            error={uploadError}
            result={uploadResult}
          />
          <Card>
            <CardHeader
              eyebrow={t("chat.borrowerTitle")}
              description={t("borrower.chatIntro")}
            />
            <Button full className="mt-4" onClick={onOpenChat}>
              {t("borrower.openChat")}
            </Button>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <LenderList
            lenders={lenders}
            state={lendersState}
            error={lendersError}
            requestingId={requestingId}
            onRequest={onRequestLender}
            onRefresh={onRefreshLenders}
            canApply={consent}
            language={language}
          />
        </div>
      </div>
    </Page>
  );
}
