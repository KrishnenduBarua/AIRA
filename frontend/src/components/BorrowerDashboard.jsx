import { useCallback, useEffect, useRef, useState } from "react";
import { request, uploadWithProgress } from "../api";
import { useLanguage } from "../i18n";
import BorrowerDashboardView from "./BorrowerDashboardView";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = /\.(pdf|csv)$/i;

export default function BorrowerDashboard({ session, onLogout }) {
  const { t, language } = useLanguage();

  const [consent, setConsent] = useState(Boolean(session.user.consentGiven));
  const [consentError, setConsentError] = useState("");
  const [savingConsent, setSavingConsent] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState("loading");
  const [profileError, setProfileError] = useState("");

  // The chosen file lives in state rather than only on the input element, so a
  // failed upload can be retried without asking the borrower to find it again.
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadPhase, setUploadPhase] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const [lenders, setLenders] = useState([]);
  const [lendersState, setLendersState] = useState("loading");
  const [lendersError, setLendersError] = useState("");
  const [requestingId, setRequestingId] = useState("");

  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatGrounding, setChatGrounding] = useState("");
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const [chatOpen, setChatOpen] = useState(
    () => new URLSearchParams(window.location.search).get("view") === "chat",
  );

  useEffect(() => {
    const handleHistoryChange = () => {
      setChatOpen(
        new URLSearchParams(window.location.search).get("view") === "chat",
      );
    };
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, []);

  const openChat = () => {
    window.history.pushState({ view: "chat" }, "", "?view=chat");
    setChatOpen(true);
  };

  const closeChat = () => {
    window.history.pushState({}, "", window.location.pathname);
    setChatOpen(false);
  };

  /* ------------------------------------------------------------- profile */

  const loadProfile = useCallback(async () => {
    setProfileState("loading");
    try {
      const data = await request("/score/me");
      setProfile(data);
      setProfileError("");
      setProfileState("ready");
    } catch (error) {
      setProfileError(error.message);
      setProfileState("error");
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, session.user.id]);

  /* ------------------------------------------------------------- lenders */

  const loadLenders = useCallback(async (mode = "initial") => {
    if (mode === "initial") setLendersState("loading");
    else setLendersState("refreshing");
    try {
      const data = await request("/loans/lenders");
      setLenders(data.lenders || []);
      setLendersError("");
      setLendersState("ready");
    } catch (error) {
      setLendersError(error.message);
      setLendersState("error");
    }
  }, []);

  useEffect(() => {
    loadLenders();
  }, [loadLenders]);

  const sendLoanRequest = async (lenderId) => {
    setLendersError("");
    setRequestingId(lenderId);
    try {
      await request("/loans/requests", {
        method: "POST",
        body: JSON.stringify({ lenderId }),
      });
      await loadLenders("refresh");
    } catch (error) {
      setLendersError(error.message);
    } finally {
      setRequestingId("");
    }
  };

  /* ------------------------------------------------------------- consent */

  const updateConsent = async () => {
    const nextConsent = !consent;
    setConsentError("");
    setSavingConsent(true);
    try {
      const data = await request("/auth/consent", {
        method: "POST",
        body: JSON.stringify({ consentGiven: nextConsent }),
      });
      setConsent(Boolean(data.consentGiven));
    } catch (error) {
      setConsentError(error.message);
    } finally {
      setSavingConsent(false);
    }
  };

  /* -------------------------------------------------------------- upload */

  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadResult(null);
    setUploadPhase("idle");
    setUploadProgress(0);

    if (!SUPPORTED_EXTENSIONS.test(file.name)) {
      setSelectedFile(null);
      setUploadError(t("upload.unsupported"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setUploadError(t("upload.tooLarge"));
      return;
    }

    setUploadError("");
    setSelectedFile(file);
  };

  const startUpload = async () => {
    if (!selectedFile) return;
    if (!consent) {
      setUploadError(t("upload.consentFirst"));
      return;
    }

    setUploadError("");
    setUploadResult(null);
    setUploadProgress(0);
    setUploadPhase("upload");

    try {
      const body = new FormData();
      body.append("statement", selectedFile);

      const uploaded = await uploadWithProgress("/statements/upload", body, {
        onProgress: (ratio) => {
          setUploadProgress(ratio);
          // Once the bytes are sent the server is verifying and parsing; the
          // single endpoint covers both, so they advance together.
          if (ratio >= 1) setUploadPhase("verify");
        },
      });

      setUploadPhase("extract");
      const features = uploaded.statement?.extractedFeatures || {};

      setUploadPhase("score");
      const result = await request("/score/compute", {
        method: "POST",
        body: JSON.stringify({ userId: session.user.id, features }),
      });

      setProfile(result);
      setProfileState("ready");
      setUploadResult({
        history: result.history || uploaded.history || null,
        filename: uploaded.statement?.filename || selectedFile.name,
      });
      setUploadPhase("done");
      // Chat answers are grounded in the score, so an old transcript's
      // context is stale once a new score lands.
      setChatGrounding("");
    } catch (error) {
      setUploadError(error.message);
      setUploadPhase("error");
    }
  };

  const resetUpload = () => {
    setUploadPhase("idle");
    setUploadProgress(0);
    setUploadError("");
    setUploadResult(null);
  };

  const clearFile = () => {
    setSelectedFile(null);
    resetUpload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---------------------------------------------------------------- chat */

  // History is fetched only when the borrower actually opens the chat, so the
  // dashboard costs one request fewer on every load.
  const loadChatHistory = useCallback(async () => {
    setChatHistoryLoading(true);
    try {
      const data = await request("/chat/borrower/history");
      setChatMessages(data.messages || []);
      setChatError("");
    } catch (_error) {
      setChatMessages([]);
    } finally {
      setChatHistoryLoading(false);
      setChatHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (chatOpen && !chatHistoryLoaded) loadChatHistory();
  }, [chatOpen, chatHistoryLoaded, loadChatHistory]);

  const askCoach = async (event) => {
    event?.preventDefault();
    const asked = chatQuestion.trim();
    if (!asked) return;
    if (!profile?.hasScore) {
      setChatError(t("chat.noScore"));
      return;
    }

    setChatLoading(true);
    setChatError("");
    const optimistic = [...chatMessages, { role: "user", content: asked }];
    setChatMessages(optimistic);
    setChatQuestion("");

    try {
      const data = await request("/chat/borrower", {
        method: "POST",
        body: JSON.stringify({ question: asked, language }),
      });
      setChatMessages(data.messages || optimistic);
      setChatGrounding(data.grounding || "");
    } catch (error) {
      // Roll the optimistic message back into the input so nothing is lost.
      setChatMessages(chatMessages);
      setChatQuestion(asked);
      setChatError(`${t("chat.failed")} ${error.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <BorrowerDashboardView
      session={session}
      onLogout={onLogout}
      chatOpen={chatOpen}
      onOpenChat={openChat}
      onCloseChat={closeChat}
      consent={consent}
      consentError={consentError}
      savingConsent={savingConsent}
      onToggleConsent={updateConsent}
      profile={profile}
      profileState={profileState}
      profileError={profileError}
      onRetryProfile={loadProfile}
      lenders={lenders}
      lendersState={lendersState}
      lendersError={lendersError}
      requestingId={requestingId}
      onRequestLender={sendLoanRequest}
      onRefreshLenders={() => loadLenders("refresh")}
      fileInputRef={fileInputRef}
      selectedFile={selectedFile}
      onChooseFile={chooseFile}
      onClearFile={clearFile}
      onStartUpload={startUpload}
      onResetUpload={resetUpload}
      uploadPhase={uploadPhase}
      uploadProgress={uploadProgress}
      uploadError={uploadError}
      uploadResult={uploadResult}
      question={chatQuestion}
      messages={chatMessages}
      chatLoading={chatLoading}
      chatHistoryLoading={chatHistoryLoading}
      chatError={chatError}
      chatGrounding={chatGrounding}
      onQuestionChange={setChatQuestion}
      onAskCoach={askCoach}
      onRetryChat={() => askCoach()}
    />
  );
}
