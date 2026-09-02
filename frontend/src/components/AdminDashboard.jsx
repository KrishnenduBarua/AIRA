import { useEffect, useState } from "react";
import { request } from "../api";

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
  const [applications, setApplications] = useState([]);
  const [approvalView, setApprovalView] = useState("overview");
  const [approvalForm, setApprovalForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const loadApplications = async () => {
    try {
      const data = await request("/auth/lender-applications");
      setApplications(data.applications || []);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const updateForm = (field, value) => {
    setApprovalForm((current) => ({ ...current, [field]: value }));
  };

  const createApproval = async (event) => {
    event.preventDefault();
    setMessage("");
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
      setMessage(data.message);
      setApprovalForm(emptyForm);
      setApprovalView("overview");
      await loadApplications();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const approve = async (applicationId) => {
    try {
      const data = await request("/auth/approve-lender", {
        method: "POST",
        body: JSON.stringify({ applicationId }),
      });
      setMessage(data.message);
      await loadApplications();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const reviewApplications = applications.filter(
    (item) => item.status === "pending",
  );
  const pendingSignup = applications.filter(
    (item) => item.status === "approved",
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Admin portal
        </p>
        <h2 className="mt-3 text-3xl font-bold text-slate-900">
          Welcome, {session.user.name}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Admin controls lender approval, review documents, and platform
          oversight.
        </p>

        {approvalView === "overview" && (
          <button
            type="button"
            onClick={() => setApprovalView("menu")}
            className="mt-6 w-full rounded-xl border border-slate-300 bg-slate-50 p-5 text-left hover:border-brand-500 hover:bg-brand-50"
          >
            <span className="block text-lg font-semibold text-slate-900">
              Lender approval
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              Create an approval or review approved lenders awaiting signup.
            </span>
          </button>
        )}

        {approvalView === "menu" && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setApprovalView("create")}
              className="rounded-xl bg-brand-700 p-5 text-left font-semibold text-white"
            >
              New lender approval
            </button>
            <button
              type="button"
              onClick={() => setApprovalView("pending")}
              className="rounded-xl border border-slate-300 bg-slate-50 p-5 text-left font-semibold text-slate-900"
            >
              Pending lender signup
            </button>
          </div>
        )}

        {approvalView === "create" && (
          <form onSubmit={createApproval} className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => setApprovalView("menu")}
              className="text-sm font-semibold text-brand-700 underline"
            >
              Back to lender approval
            </button>
            <h3 className="pt-2 text-lg font-semibold text-slate-900">
              New lender approval
            </h3>
            <input
              required
              placeholder="Organization name"
              value={approvalForm.organizationName}
              onChange={(event) =>
                updateForm("organizationName", event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <input
              required
              placeholder="Lender phone number"
              value={approvalForm.phoneNumber}
              onChange={(event) =>
                updateForm("phoneNumber", event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            {documentFields.map(([field, label]) => (
              <label key={field} className="block text-sm text-slate-600">
                {label}
                <input
                  required
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    updateForm(field, event.target.files?.[0] || null)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
            ))}
            <button
              type="submit"
              className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white"
            >
              Create approval
            </button>
          </form>
        )}

        {approvalView === "pending" && (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => setApprovalView("menu")}
              className="text-sm font-semibold text-brand-700 underline"
            >
              Back to lender approval
            </button>
            <h3 className="pt-2 text-lg font-semibold text-slate-900">
              Approved lenders awaiting signup
            </h3>
            {pendingSignup.length === 0 && (
              <p className="text-sm text-slate-500">
                No approved lenders are waiting for signup.
              </p>
            )}
            {pendingSignup.map((application) => (
              <div
                key={application.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="font-semibold text-slate-900">
                  {application.organizationName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Phone: {application.phoneNumber}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Approved, OTP signup pending
                </p>
              </div>
            ))}
          </div>
        )}
        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Actions
        </p>
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Approval review
          </p>
          {reviewApplications.length === 0 && (
            <p className="text-sm text-slate-500">
              No approvals awaiting review.
            </p>
          )}
          {reviewApplications.map((application) => (
            <div
              key={application.id}
              className="rounded-xl border border-slate-200 p-3"
            >
              <p className="font-semibold text-slate-900">
                {application.organizationName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {application.phoneNumber}
              </p>
              <button
                type="button"
                onClick={() => approve(application.id)}
                className="mt-3 w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
              >
                Approve lender
              </button>
            </div>
          ))}
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
