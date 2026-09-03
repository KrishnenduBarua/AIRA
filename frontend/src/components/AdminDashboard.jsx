import { useCallback, useEffect, useState } from "react";
import { request } from "../api";
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
    <Page>
      <Card>
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
