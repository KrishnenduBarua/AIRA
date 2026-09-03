import { useState } from "react";
import { request } from "../api";
import { useLanguage } from "../i18n";
import {
  Alert,
  Button,
  Card,
  Field,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";

export default function AuthFlow({ mode, onSuccess }) {
  const { t } = useLanguage();
  const isBorrower = mode === "borrower";
  const isAdmin = mode === "admin";

  const [authTab, setAuthTab] = useState(isAdmin ? "login" : "signup");
  const [step, setStep] = useState("phone");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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

  // Every submit routes through here so loading and error handling stay
  // identical across the three signup steps and login.
  const run = async (action) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = (event) => {
    event.preventDefault();
    return run(async () => {
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
      if (data.user) setPhone(data.user.phone || phone);
    });
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    return run(async () => {
      const data = await request("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp }),
      });
      setVerifiedPhone(true);
      setVerificationToken(data.verificationToken || "");
      setStep("profile");
      if (data.user) setPhone(data.user.phone || phone);
    });
  };

  const handleFileUpload = (fieldName, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfile((current) => ({ ...current, [fieldName]: file }));
  };

  const completeRegistration = (event) => {
    event.preventDefault();
    if (isBorrower && (!profile.nidFrontFile || !profile.nidBackFile)) {
      setError(t("auth.bothNidRequired"));
      return undefined;
    }

    return run(async () => {
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
    });
  };

  const login = (event) => {
    event.preventDefault();
    return run(async () => {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          phone: loginForm.phone,
          password: loginForm.password,
          role: mode,
        }),
      });
      onSuccess(data);
    });
  };

  const showRoleTabs = !isAdmin;
  const showLogin = isAdmin || authTab === "login";
  const showSignup = !isAdmin && authTab === "signup";

  const heading = showLogin
    ? t("auth.loginTitle")
    : step === "phone"
      ? t("auth.createTitle")
      : step === "otp"
        ? t("auth.verifyTitle")
        : t("auth.detailsTitle");

  return (
    <Card className="aira-auth-card">
      <div className="mb-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-brand-700">
          {t("app.name")}
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
          {heading}
        </h2>
      </div>

      {showRoleTabs && (
        <div
          role="tablist"
          aria-label={t("auth.login")}
          className="mb-5 flex rounded-xl bg-slate-100 p-1"
        >
          {[
            { key: "signup", label: t("auth.signup") },
            { key: "login", label: t("auth.login") },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={authTab === tab.key}
              onClick={() => {
                setAuthTab(tab.key);
                if (tab.key === "signup") resetSignup();
                else setError("");
              }}
              className={cx(
                "min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition",
                authTab === tab.key
                  ? "bg-brand-700 text-white"
                  : "text-slate-600 hover:bg-slate-200",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {showLogin && (
        <form onSubmit={login} className="space-y-4" noValidate>
          <TextInput
            required
            label={isBorrower ? t("auth.phoneMfsLabel") : t("common.phone")}
            help={t(isBorrower ? "auth.phoneLoginHelp" : "auth.phoneLenderHelp")}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={loginForm.phone}
            onChange={(e) =>
              setLoginForm((current) => ({ ...current, phone: e.target.value }))
            }
          />
          <TextInput
            required
            label={t("common.password")}
            type="password"
            autoComplete="current-password"
            value={loginForm.password}
            onChange={(e) =>
              setLoginForm((current) => ({
                ...current,
                password: e.target.value,
              }))
            }
          />
          <Button type="submit" full disabled={busy}>
            {busy ? t("common.loading") : t("auth.login")}
          </Button>
        </form>
      )}

      {showSignup && step === "phone" && (
        <form onSubmit={sendOtp} className="space-y-4" noValidate>
          <TextInput
            required
            label={isBorrower ? t("auth.phoneMfsLabel") : t("common.phone")}
            help={t(isBorrower ? "auth.phoneMfsHelp" : "auth.phoneLenderHelp")}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" full disabled={busy || !phone.trim()}>
            {busy ? t("auth.sending") : t("auth.sendOtp")}
          </Button>
          <Alert variant="info">
            {t(isBorrower ? "auth.borrowerNote" : "auth.lenderNote")}
          </Alert>
        </form>
      )}

      {showSignup && step === "otp" && (
        <form onSubmit={verifyOtp} className="space-y-4" noValidate>
          <TextInput
            required
            label={t("auth.otpLabel")}
            help={t("auth.otpHelp", { phone })}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="tracking-widest"
          />
          <Button type="submit" full disabled={busy || otp.length < 4}>
            {busy ? t("auth.verifying") : t("auth.verifyOtp")}
          </Button>
          <Button
            variant="ghost"
            full
            onClick={() => {
              setStep("phone");
              setOtp("");
              setError("");
            }}
          >
            {t("auth.changeNumber")}
          </Button>
        </form>
      )}

      {showSignup && step === "profile" && (
        <form onSubmit={completeRegistration} className="space-y-4" noValidate>
          {verifiedPhone && (
            <Alert variant="success">{t("auth.phoneVerified")}</Alert>
          )}

          {isBorrower && (
            <>
              <Alert variant="warning">{t("auth.nidNotice")}</Alert>
              <TextInput
                required
                label={t("auth.fullName")}
                autoComplete="name"
                value={profile.fullName}
                onChange={(e) =>
                  setProfile({ ...profile, fullName: e.target.value })
                }
              />
              <TextInput
                required
                label={t("auth.dob")}
                type="date"
                value={profile.dob}
                onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
              />
              <TextInput
                required
                label={t("auth.nidNumber")}
                inputMode="numeric"
                value={profile.nidNumber}
                onChange={(e) =>
                  setProfile({ ...profile, nidNumber: e.target.value })
                }
              />
              <TextArea
                required
                rows={3}
                label={t("auth.address")}
                value={profile.permanentAddress}
                onChange={(e) =>
                  setProfile({ ...profile, permanentAddress: e.target.value })
                }
              />
            </>
          )}

          <TextInput
            required
            label={t("common.password")}
            help={t("auth.passwordHelp")}
            type="password"
            autoComplete="new-password"
            value={profile.password}
            onChange={(e) =>
              setProfile({ ...profile, password: e.target.value })
            }
          />

          {isBorrower && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["nidFrontFile", t("auth.nidFront")],
                ["nidBackFile", t("auth.nidBack")],
              ].map(([fieldName, label]) => (
                <Field
                  key={fieldName}
                  required
                  label={label}
                  help={t("auth.nidHelp")}
                >
                  {(props) => (
                    <>
                      <input
                        {...props}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => handleFileUpload(fieldName, event)}
                        className={cx(
                          props.className,
                          "file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-800",
                        )}
                      />
                      {profile[fieldName] && (
                        <p className="mt-1.5 break-all text-xs font-medium text-green-700">
                          ✓ {profile[fieldName].name}
                        </p>
                      )}
                    </>
                  )}
                </Field>
              ))}
            </div>
          )}

          <Button type="submit" full disabled={busy}>
            {busy ? t("auth.creating") : t("auth.createAccount")}
          </Button>
        </form>
      )}

      {showSignup && (otpSent || step !== "phone") && (
        <div className="mt-5 flex justify-center">
          <Button variant="ghost" onClick={resetSignup}>
            {t("auth.startOver")}
          </Button>
        </div>
      )}
    </Card>
  );
}
