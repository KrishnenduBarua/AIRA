import { useCallback, useEffect, useState } from "react";
import { API_URL, request } from "../api";
import { useLanguage } from "../i18n";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Page,
  SkeletonList,
  SplitLayout,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";

const documentFields = [
  ["tradeLicense", "Trade License"],
  ["tinCertificate", "TIN Certificate"],
  ["binCertificate", "BIN Certificate"],
  ["personalNid", "Lender Personal NID"],
];

const emptyForm = {
  organizationName: "",
  phoneNumber: "",
  tradeLicense: null,
  tinCertificate: null,
  binCertificate: null,
  personalNid: null,
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function BorrowerDetails({ borrower, onBack, onDelete, deleting }) {
  const { t } = useLanguage();
  const detailItems = [
    [t("auth.fullName"), borrower.name],
    [t("common.phone"), borrower.phoneNumber],
    [t("auth.dob"), borrower.dateOfBirth || "—"],
    [t("auth.nidNumber"), borrower.nidNumber || "—"],
    [t("auth.address"), borrower.permanentAddress || "—"],
    [t("admin.nidStatus"), borrower.nidVerified ? t("common.verified") : t("common.pending")],
    [t("consent.title"), borrower.consentGiven ? t("common.yes") : t("common.no")],
    [t("admin.createdAt"), formatDate(borrower.createdAt)],
  ];

  return (
    <div className="mt-4">
      <Button variant="subtle" onClick={onBack}>
        {t("common.back")}
      </Button>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {detailItems.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 break-words text-sm text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4">
        <p className="text-sm font-semibold text-brand-900">{t("admin.nidDocuments")}</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{t("admin.nidDocumentsHelp")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {borrower.documents?.front && (
            <a
              href={`${API_URL}${borrower.documents.front}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              {t("auth.nidFront")}
            </a>
          )}
          {borrower.documents?.back && (
            <a
              href={`${API_URL}${borrower.documents.back}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              {t("auth.nidBack")}
            </a>
          )}
          {!borrower.documents?.front && !borrower.documents?.back && (
            <p className="text-sm text-slate-600">{t("admin.noNidDocuments")}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="danger" onClick={onDelete} disabled={deleting}>
          {deleting ? t("admin.deleting") : t("admin.deleteBorrower")}
        </Button>
      </div>
    </div>
  );
}

function BorrowerDirectory({
  borrowers,
  state,
  error,
  selectedBorrower,
  onOpen,
  onBack,
  onRefresh,
  onDelete,
  deleting,
}) {
  const { t } = useLanguage();

  return (
    <Card className="admin-borrowers-card">
      <CardHeader
        eyebrow={t("admin.borrowers")}
        description={t("admin.borrowersHelp")}
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

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      {selectedBorrower ? (
        <BorrowerDetails
          borrower={selectedBorrower}
          onBack={onBack}
          onDelete={onDelete}
          deleting={deleting}
        />
      ) : state === "loading" ? (
        <div className="mt-4">
          <SkeletonList rows={3} label={t("common.loading")} />
        </div>
      ) : borrowers.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t("admin.noBorrowers")} />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {borrowers.map((borrower) => (
            <li key={borrower.id}>
              <button
                type="button"
                onClick={() => onOpen(borrower.id)}
                className="admin-borrower-card flex min-h-36 w-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
              >
                <span className="min-w-0 break-words font-semibold text-slate-900">
                  {borrower.name}
                </span>
                <span className="mt-1 break-words text-sm text-slate-600">
                  {borrower.phoneNumber}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  <Badge tone={borrower.nidVerified ? "success" : "warning"}>
                    {borrower.nidVerified ? t("common.verified") : t("common.pending")}
                  </Badge>
                  <Badge tone={borrower.hasNidFront && borrower.hasNidBack ? "info" : "neutral"}>
                    {borrower.hasNidFront && borrower.hasNidBack
                      ? t("admin.nidComplete")
                      : t("admin.nidIncomplete")}
                  </Badge>
                  <span className="aira-details-cta ml-auto">
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

const FRAUD_REVIEW_TONES = {
  pending: "danger",
  reviewing: "warning",
  cleared: "success",
  confirmed: "danger",
};

function FraudReviewDirectory({
  reviews,
  state,
  error,
  selectedReview,
  reviewStatus,
  adminNotes,
  onOpen,
  onBack,
  onRefresh,
  onStatusChange,
  onNotesChange,
  onSave,
  saving,
}) {
  const { t } = useLanguage();

  return (
    <Card className="admin-fraud-card">
      <CardHeader
        eyebrow={t("admin.fraudReviews")}
        description={t("admin.fraudReviewsHelp")}
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

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      {selectedReview ? (
        <div className="mt-4">
          <Button variant="subtle" onClick={onBack}>
            {t("common.back")}
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">
              {selectedReview.borrower.name}
            </h3>
            <Badge tone={FRAUD_REVIEW_TONES[selectedReview.status] || "neutral"}>
              {t(`admin.fraudStatus.${selectedReview.status}`)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.referredBy")}: {selectedReview.lender?.name || "—"}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              [t("common.phone"), selectedReview.borrower.phoneNumber],
              [t("auth.dob"), selectedReview.borrower.dateOfBirth || "—"],
              [t("auth.nidNumber"), selectedReview.borrower.nidNumber || "—"],
              [t("auth.address"), selectedReview.borrower.permanentAddress || "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">{t("admin.fraudReason")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">
              {selectedReview.reason}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4">
            <p className="text-sm font-semibold text-brand-900">{t("admin.nidDocuments")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[["front", t("auth.nidFront")], ["back", t("auth.nidBack")]].map(([side, label]) =>
                selectedReview.borrower.documents?.[side] ? (
                  <a
                    key={side}
                    href={`${API_URL}${selectedReview.borrower.documents[side]}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                  >
                    {label}
                  </a>
                ) : null,
              )}
            </div>
          </div>

          {selectedReview.score && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {t("admin.scoreSummary")}: {selectedReview.score.score ?? "—"} / 100 · {selectedReview.score.tier || "—"}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <Field label={t("admin.reviewStatus")}>
              {(props) => (
                <select
                  {...props}
                  value={reviewStatus}
                  onChange={(event) => onStatusChange(event.target.value)}
                >
                  {["pending", "reviewing", "cleared", "confirmed"].map((status) => (
                    <option key={status} value={status}>
                      {t("admin.fraudStatus." + status)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <TextArea
              rows={4}
              label={t("admin.adminNotes")}
              help={t("admin.adminNotesHelp")}
              value={adminNotes}
              onChange={(event) => onNotesChange(event.target.value)}
              disabled={saving}
            />
            <Button onClick={onSave} disabled={saving}>
              {saving ? t("admin.savingReview") : t("admin.saveReview")}
            </Button>
          </div>
        </div>
      ) : state === "loading" ? (
        <div className="mt-4">
          <SkeletonList rows={2} label={t("common.loading")} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t("admin.noFraudReviews")} />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id}>
              <button
                type="button"
                onClick={() => onOpen(review.id)}
                className="flex min-h-36 w-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-red-300 hover:bg-red-50"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold text-slate-900">
                    {review.borrowerName}
                  </span>
                  <Badge tone={FRAUD_REVIEW_TONES[review.status] || "neutral"}>
                    {t(`admin.fraudStatus.${review.status}`)}
                  </Badge>
                </span>
                <span className="mt-1 break-words text-sm text-slate-600">
                  {review.borrowerPhone}
                </span>
                <span className="mt-2 text-xs text-slate-500">
                  {t("admin.referredBy")}: {review.lenderName}
                </span>
                <span className="mt-auto line-clamp-2 pt-3 text-sm text-slate-700">
                  {review.reason}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function AdminDashboard({ session, onLogout }) {
  const { t } = useLanguage();

  const [applications, setApplications] = useState([]);
  const [listState, setListState] = useState("loading");
  const [approvalView, setApprovalView] = useState("overview");
  const [approvalForm, setApprovalForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [approvingId, setApprovingId] = useState("");

  const [borrowers, setBorrowers] = useState([]);
  const [borrowersState, setBorrowersState] = useState("loading");
  const [borrowersError, setBorrowersError] = useState("");
  const [selectedBorrower, setSelectedBorrower] = useState(null);
  const [deletingBorrower, setDeletingBorrower] = useState(false);
  const [fraudReviews, setFraudReviews] = useState([]);
  const [fraudReviewsState, setFraudReviewsState] = useState("loading");
  const [fraudReviewsError, setFraudReviewsError] = useState("");
  const [selectedFraudReview, setSelectedFraudReview] = useState(null);
  const [fraudReviewStatus, setFraudReviewStatus] = useState("pending");
  const [fraudAdminNotes, setFraudAdminNotes] = useState("");
  const [savingFraudReview, setSavingFraudReview] = useState(false);

  const loadApplications = useCallback(async (mode = "initial") => {
    setListState(mode === "initial" ? "loading" : "refreshing");
    try {
      const data = await request("/auth/lender-applications");
      setApplications(data.applications || []);
      setError("");
      setListState("ready");
    } catch (err) {
      setError(err.message);
      setListState("error");
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const loadBorrowers = useCallback(async (mode = "initial") => {
    setBorrowersState(mode === "initial" ? "loading" : "refreshing");
    try {
      const data = await request("/auth/admin/borrowers");
      setBorrowers(data.borrowers || []);
      setBorrowersError("");
      setBorrowersState("ready");
    } catch (err) {
      setBorrowersError(err.message);
      setBorrowersState("error");
    }
  }, []);

  useEffect(() => {
    loadBorrowers();
  }, [loadBorrowers]);

  const loadFraudReviews = useCallback(async (mode = "initial") => {
    setFraudReviewsState(mode === "initial" ? "loading" : "refreshing");
    try {
      const data = await request("/auth/admin/fraud-reviews");
      setFraudReviews(data.fraudReviews || []);
      setFraudReviewsError("");
      setFraudReviewsState("ready");
    } catch (err) {
      setFraudReviewsError(err.message);
      setFraudReviewsState("error");
    }
  }, []);

  useEffect(() => {
    loadFraudReviews();
  }, [loadFraudReviews]);

  const openBorrower = async (borrowerId) => {
    setBorrowersError("");
    try {
      const data = await request(
        `/auth/admin/borrowers/${encodeURIComponent(borrowerId)}`,
      );
      setSelectedBorrower(data.borrower);
    } catch (err) {
      setBorrowersError(err.message);
    }
  };

  const openFraudReview = async (reviewId) => {
    setFraudReviewsError("");
    try {
      const data = await request(
        "/auth/admin/fraud-reviews/" + encodeURIComponent(reviewId),
      );
      setSelectedFraudReview(data.fraudReview);
      setFraudReviewStatus(data.fraudReview.status);
      setFraudAdminNotes(data.fraudReview.adminNotes || "");
    } catch (err) {
      setFraudReviewsError(err.message);
    }
  };

  const saveFraudReview = async () => {
    if (!selectedFraudReview) return;
    setSavingFraudReview(true);
    setFraudReviewsError("");
    try {
      const data = await request(
        "/auth/admin/fraud-reviews/" +
          encodeURIComponent(selectedFraudReview.id),
        {
          method: "PATCH",
          body: JSON.stringify({
            status: fraudReviewStatus,
            adminNotes: fraudAdminNotes,
          }),
        },
      );
      setSelectedFraudReview((current) => ({
        ...current,
        ...data.fraudReview,
      }));
      await loadFraudReviews("refresh");
    } catch (err) {
      setFraudReviewsError(err.message);
    } finally {
      setSavingFraudReview(false);
    }
  };

  const removeBorrower = async () => {
    if (!selectedBorrower || deletingBorrower) return;
    if (!window.confirm(t("admin.deleteBorrowerConfirm"))) return;

    setDeletingBorrower(true);
    setBorrowersError("");
    setError("");
    setSuccess("");
    try {
      const data = await request(
        `/auth/admin/borrowers/${encodeURIComponent(selectedBorrower.id)}`,
        { method: "DELETE" },
      );
      setSelectedBorrower(null);
      setSuccess(data.message);
      await loadBorrowers("refresh");
    } catch (err) {
      setBorrowersError(err.message);
    } finally {
      setDeletingBorrower(false);
    }
  };

  const updateForm = (field, value) => {
    setApprovalForm((current) => ({ ...current, [field]: value }));
  };

  const createApproval = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);

    const formData = new FormData();
    formData.append("organizationName", approvalForm.organizationName);
    formData.append("phoneNumber", approvalForm.phoneNumber);
    documentFields.forEach(([field]) =>
      formData.append(field, approvalForm[field]),
    );

    try {
      const data = await request("/auth/admin/lender-approvals", {
        method: "POST",
        body: formData,
      });
      setSuccess(data.message);
      setApprovalForm(emptyForm);
      setApprovalView("overview");
      await loadApplications("refresh");
    } catch (err) {
      // The form is left intact so nothing typed or attached is lost.
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const approve = async (applicationId) => {
    setError("");
    setSuccess("");
    setApprovingId(applicationId);
    try {
      const data = await request("/auth/approve-lender", {
        method: "POST",
        body: JSON.stringify({ applicationId }),
      });
      setSuccess(data.message);
      await loadApplications("refresh");
    } catch (err) {
      setError(err.message);
    } finally {
      setApprovingId("");
    }
  };

  const reviewApplications = applications.filter(
    (item) => item.status === "pending",
  );
  const pendingSignup = applications.filter((item) => item.status === "approved");

  return (
    <Page className="dashboard-page admin-page">
      <Card className="dashboard-hero admin-hero">
        <CardHeader
          eyebrow={t("admin.portal")}
          title={t("admin.welcome", { name: session.user.name })}
          description={t("admin.subtitle")}
          actions={
            <Button variant="secondary" onClick={onLogout}>
              {t("common.logout")}
            </Button>
          }
        />
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <BorrowerDirectory
        borrowers={borrowers}
        state={borrowersState}
        error={borrowersError}
        selectedBorrower={selectedBorrower}
        onOpen={openBorrower}
        onBack={() => setSelectedBorrower(null)}
        onRefresh={() => loadBorrowers("refresh")}
        onDelete={removeBorrower}
        deleting={deletingBorrower}
      />

      <FraudReviewDirectory
        reviews={fraudReviews}
        state={fraudReviewsState}
        error={fraudReviewsError}
        selectedReview={selectedFraudReview}
        reviewStatus={fraudReviewStatus}
        adminNotes={fraudAdminNotes}
        onOpen={openFraudReview}
        onBack={() => setSelectedFraudReview(null)}
        onRefresh={() => loadFraudReviews("refresh")}
        onStatusChange={setFraudReviewStatus}
        onNotesChange={setFraudAdminNotes}
        onSave={saveFraudReview}
        saving={savingFraudReview}
      />

      <SplitLayout
        main={
          <Card>
            <CardHeader
              eyebrow={t("admin.lenderApproval")}
              description={t("admin.lenderApprovalHelp")}
              actions={
                approvalView !== "overview" ? (
                  <Button
                    variant="secondary"
                    onClick={() => setApprovalView("overview")}
                  >
                    {t("admin.backToApproval")}
                  </Button>
                ) : null
              }
            />

            {approvalView === "overview" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setApprovalView("create")}
                  className="min-h-24 rounded-xl bg-brand-700 p-4 text-left text-white transition hover:bg-brand-800"
                >
                  <span className="block font-semibold">
                    {t("admin.newApproval")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalView("pending")}
                  className="min-h-24 rounded-xl border border-slate-300 bg-slate-50 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
                >
                  <span className="block font-semibold text-slate-900">
                    {t("admin.pendingSignup")}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {pendingSignup.length}
                  </span>
                </button>
              </div>
            )}

            {approvalView === "create" && (
              <form onSubmit={createApproval} className="mt-4 space-y-4">
                <TextInput
                  required
                  label={t("admin.orgName")}
                  value={approvalForm.organizationName}
                  onChange={(event) =>
                    updateForm("organizationName", event.target.value)
                  }
                />
                <TextInput
                  required
                  label={t("admin.orgPhone")}
                  type="tel"
                  inputMode="numeric"
                  value={approvalForm.phoneNumber}
                  onChange={(event) =>
                    updateForm("phoneNumber", event.target.value)
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {documentFields.map(([fieldName, label]) => (
                    <Field
                      key={fieldName}
                      required
                      label={label}
                      help={t("admin.docsHelp")}
                    >
                      {(props) => (
                        <>
                          <input
                            {...props}
                            required
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(event) =>
                              updateForm(
                                fieldName,
                                event.target.files?.[0] || null,
                              )
                            }
                            className={cx(
                              props.className,
                              "file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-800",
                            )}
                          />
                          {approvalForm[fieldName] && (
                            <p className="mt-1.5 break-all text-xs font-medium text-green-700">
                              ✓ {approvalForm[fieldName].name}
                            </p>
                          )}
                        </>
                      )}
                    </Field>
                  ))}
                </div>
                <Button type="submit" full disabled={creating}>
                  {creating ? t("admin.creating") : t("admin.createApproval")}
                </Button>
              </form>
            )}

            {approvalView === "pending" && (
              <div className="mt-4">
                {listState === "loading" ? (
                  <SkeletonList rows={2} label={t("common.loading")} />
                ) : pendingSignup.length === 0 ? (
                  <EmptyState title={t("admin.noPendingSignup")} />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {pendingSignup.map((application) => (
                      <li
                        key={application.id}
                        className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="break-words font-semibold text-slate-900">
                          {application.organizationName}
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-600">
                          {application.phoneNumber}
                        </p>
                        <Badge tone="warning" className="mt-2">
                          {t("admin.approvedNote")}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        }
        aside={
          <Card>
            <CardHeader
              eyebrow={t("admin.awaitingReview")}
              actions={
                <Button
                  variant="secondary"
                  onClick={() => loadApplications("refresh")}
                  disabled={listState === "refreshing"}
                >
                  {listState === "refreshing"
                    ? t("common.loading")
                    : t("common.refresh")}
                </Button>
              }
            />
            <div className="mt-4 space-y-3">
              {listState === "loading" ? (
                <SkeletonList rows={2} label={t("common.loading")} />
              ) : reviewApplications.length === 0 ? (
                <EmptyState title={t("admin.noReview")} />
              ) : (
                reviewApplications.map((application) => (
                  <div
                    key={application.id}
                    className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="break-words font-semibold text-slate-900">
                      {application.organizationName}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-600">
                      {application.phoneNumber}
                    </p>
                    <Button
                      full
                      className="mt-3"
                      onClick={() => approve(application.id)}
                      disabled={approvingId === application.id}
                    >
                      {approvingId === application.id
                        ? t("admin.approving")
                        : t("admin.approve")}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        }
      />
    </Page>
  );
}
