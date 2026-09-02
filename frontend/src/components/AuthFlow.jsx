import { useState } from "react";
import { request } from "../api";

function RequiredLabel({ children }) {
  return (
    <label className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-700">
      <span>{children}</span>
      <span className="text-red-500">*</span>
    </label>
  );
}

export default function AuthFlow({ mode, onSuccess }) {
  const isBorrower = mode === "borrower";
  const isAdmin = mode === "admin";
  const [authTab, setAuthTab] = useState(isAdmin ? "login" : "signup");
  const [step, setStep] = useState("phone");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [profile, setProfile] = useState({
    fullName: "",
    dob: "",
    nidNumber: "",
    permanentAddress: "",
    password: "",
    nidFrontFile: null,
    nidBackFile: null,
  });
  const [verifiedPhone, setVerifiedPhone] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");

  const resetSignup = () => {
    setStep("phone");
    setOtpSent(false);
    setVerifiedPhone(false);
    setVerificationToken("");
    setError("");
    setOtp("");
    setProfile({
      fullName: "",
      dob: "",
      nidNumber: "",
      permanentAddress: "",
      password: "",
      nidFrontFile: null,
      nidBackFile: null,
    });
  };

  const sendOtp = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const data = await request("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({
          phone,
          role: isBorrower ? "borrower" : "lender",
        }),
      });

      setOtpSent(true);
      setStep("otp");
      setVerifiedPhone(false);
      if (data.user) {
        setPhone(data.user.phone || phone);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const data = await request("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp }),
      });

      setVerifiedPhone(true);
      setVerificationToken(data.verificationToken || "");
      setStep("profile");
      if (data.user) {
        setPhone(data.user.phone || phone);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = (fieldName, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfile((current) => ({ ...current, [fieldName]: file }));
  };

  const completeRegistration = async (event) => {
    event.preventDefault();
    setError("");

    if (isBorrower && (!profile.nidFrontFile || !profile.nidBackFile)) {
      setError("Both front and back NID images are required.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("phone", phone);
      if (isBorrower) {
        formData.append("fullName", profile.fullName);
        formData.append("dob", profile.dob);
        formData.append("nidNumber", profile.nidNumber);
        formData.append("permanentAddress", profile.permanentAddress);
      }
      formData.append("password", profile.password);
      formData.append("verificationToken", verificationToken);
      formData.append("role", isBorrower ? "borrower" : "lender");
      if (isBorrower) {
        formData.append("nidFront", profile.nidFrontFile);
        formData.append("nidBack", profile.nidBackFile);
      }

      const data = await request("/auth/register", {
        method: "POST",
        body: formData,
      });

      onSuccess({
        token: data.token || "",
        user: {
          ...data.user,
          name: data.user?.name || profile.fullName,
        },
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const login = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          phone: loginForm.phone,
          password: loginForm.password,
          role: mode,
        }),
      });

      onSuccess(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const showRoleTabs = !isAdmin;
  const showLogin = isAdmin || authTab === "login";
  const showSignup = !isAdmin && authTab === "signup";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">
          AIRA
        </p>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">
          {showLogin
            ? "Login to your account"
            : step === "phone"
              ? "Create your account"
              : step === "otp"
                ? "Verify your phone"
                : "Complete NID details"}
        </h2>
      </div>

      {showRoleTabs && (
        <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setAuthTab("signup");
              resetSignup();
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${authTab === "signup" ? "bg-brand-700 text-white" : "text-slate-600"}`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab("login");
              setError("");
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${authTab === "login" ? "bg-brand-700 text-white" : "text-slate-600"}`}
          >
            Login
          </button>
        </div>
      )}

      {showLogin && (
        <form onSubmit={login} className="space-y-4">
          <div>
            <RequiredLabel>Phone number</RequiredLabel>
            <input
              value={loginForm.phone}
              onChange={(e) =>
                setLoginForm((current) => ({
                  ...current,
                  phone: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <RequiredLabel>Password</RequiredLabel>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((current) => ({
                  ...current,
                  password: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition hover:bg-brand-800"
          >
            Login
          </button>
        </form>
      )}

      {showSignup && step === "phone" && (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <RequiredLabel>Phone number</RequiredLabel>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01819955776"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition hover:bg-brand-800"
          >
            Send OTP
          </button>
        </form>
      )}

      {showSignup && step === "otp" && (
        <form onSubmit={verifyOtp} className="space-y-4">
          <div>
            <RequiredLabel>OTP code</RequiredLabel>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition hover:bg-brand-800"
          >
            Verify OTP
          </button>
        </form>
      )}

      {showSignup && step === "profile" && (
        <form onSubmit={completeRegistration} className="space-y-4">
          {isBorrower && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Please fill every field exactly as it appears on the customer’s
              NID document before creating the account.
            </div>
          )}

          {isBorrower && (
            <div>
              <RequiredLabel>Full name</RequiredLabel>
              <input
                value={profile.fullName}
                onChange={(e) =>
                  setProfile({ ...profile, fullName: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          )}
          {isBorrower && (
            <div>
              <RequiredLabel>Date of birth</RequiredLabel>
              <input
                type="date"
                value={profile.dob}
                onChange={(e) =>
                  setProfile({ ...profile, dob: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          )}
          {isBorrower && (
            <div>
              <RequiredLabel>NID number</RequiredLabel>
              <input
                value={profile.nidNumber}
                onChange={(e) =>
                  setProfile({ ...profile, nidNumber: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          )}
          {isBorrower && (
            <div>
              <RequiredLabel>Permanent address</RequiredLabel>
              <textarea
                rows={3}
                value={profile.permanentAddress}
                onChange={(e) =>
                  setProfile({ ...profile, permanentAddress: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          )}
          <div>
            <RequiredLabel>Password</RequiredLabel>
            <input
              type="password"
              value={profile.password}
              onChange={(e) =>
                setProfile({ ...profile, password: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          {isBorrower && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <RequiredLabel>NID front image</RequiredLabel>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleFileUpload("nidFrontFile", event)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
                {profile.nidFrontFile && (
                  <p className="mt-2 text-xs text-slate-600">
                    {profile.nidFrontFile.name}
                  </p>
                )}
              </div>
              <div>
                <RequiredLabel>NID back image</RequiredLabel>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleFileUpload("nidBackFile", event)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
                {profile.nidBackFile && (
                  <p className="mt-2 text-xs text-slate-600">
                    {profile.nidBackFile.name}
                  </p>
                )}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition hover:bg-brand-800"
          >
            Create account
          </button>
        </form>
      )}

      {!otpSent && !verifiedPhone && showSignup && (
        <div className="mt-4 text-sm text-slate-500">
          {isBorrower
            ? "Borrower accounts require phone verification before profile creation."
            : "Lender accounts require admin approval before final onboarding."}
        </div>
      )}

      {verifiedPhone && (
        <div className="mt-4 text-sm text-green-700">
          Phone number verified successfully.
        </div>
      )}

      {showSignup && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            className="text-sm font-medium text-brand-700 underline"
            onClick={() => {
              setStep("phone");
              setOtpSent(false);
              setVerifiedPhone(false);
              setVerificationToken("");
              setError("");
              setOtp("");
            }}
          >
            Start over
          </button>
        </div>
      )}
    </section>
  );
}
