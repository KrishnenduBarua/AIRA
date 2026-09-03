import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "../api";
import BorrowerDashboardView from "./BorrowerDashboardView";

export default function BorrowerDashboard({ session, onLogout }) {
  const [consent, setConsent] = useState(Boolean(session.user.consentGiven));
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(true);
  const [savingConsent, setSavingConsent] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [lenders, setLenders] = useState([]);
  const [lendersError, setLendersError] = useState("");
  const [requestingId, setRequestingId] = useState("");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
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

  useEffect(() => {
    let active = true;
    request("/score/me")
      .then((data) => {
        if (active) setScoreData(data.hasScore === false ? null : data);
      })
      .catch(() => {
        if (active) setScoreData(null);
      });
    return () => {
      active = false;
    };
  }, [session.user.id]);

  useEffect(() => {
    request("/chat/borrower/history")
      .then((data) => setChatMessages(data.messages || []))
      .catch(() => setChatMessages([]));
  }, [session.user.id]);

  const loadLenders = useCallback(async () => {
    try {
      const data = await request("/loans/lenders");
      setLenders(data.lenders || []);
      setLendersError("");
    } catch (error) {
      setLendersError(error.message);
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
      await loadLenders();
    } catch (error) {
      setLendersError(error.message);
    } finally {
      setRequestingId("");
    }
  };

  const updateConsent = async () => {
    const nextConsent = !consent;
    setMessage("");
    setSavingConsent(true);
    try {
      const data = await request("/auth/consent", {
        method: "POST",
        body: JSON.stringify({ consentGiven: nextConsent }),
      });
      setConsent(Boolean(data.consentGiven));
    } catch (error) {
      setMessageIsError(true);
      setMessage(error.message);
    } finally {
      setSavingConsent(false);
    }
  };

  const uploadStatement = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!consent) {
      setMessageIsError(true);
      setMessage("Please grant consent before uploading a statement.");
      return;
    }
    setMessage("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("statement", file);
      const uploaded = await request("/statements/upload", {
        method: "POST",
        body,
      });
      const result = await request("/score/compute", {
        method: "POST",
        body: JSON.stringify({
          userId: session.user.id,
          features: uploaded.statement.extractedFeatures,
        }),
      });
      setScoreData(result);
      setMessageIsError(false);
      setMessage("Your score is ready.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  const askCoach = async (event) => {
    event.preventDefault();
    if (!chatQuestion.trim()) return;
    if (!scoreData) {
      setChatError(
        "No score is available yet. Please compute a score before asking the AI coach.",
      );
      return;
    }
    setChatLoading(true);
    setChatError("");
    const userMessage = { role: "user", content: chatQuestion.trim() };
    const nextMessages = [...chatMessages, userMessage];
    setChatQuestion("");
    setChatMessages(nextMessages);
    try {
      const data = await request("/chat/borrower", {
        method: "POST",
        body: JSON.stringify({
          question: chatQuestion,
          score: scoreData.score,
          riskLevel: scoreData.riskLevel,
          tier: scoreData.tier,
          factors: scoreData.factors || {},
        }),
      });
      setChatMessages(data.messages || nextMessages);
    } catch (error) {
      setChatError(error.message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <BorrowerDashboardView
      chatOpen={chatOpen}
      onOpenChat={openChat}
      onCloseChat={closeChat}
      session={session}
      onLogout={onLogout}
      consent={consent}
      savingConsent={savingConsent}
      onToggleConsent={updateConsent}
      scoreData={scoreData}
      message={message}
      messageIsError={messageIsError}
      lenders={lenders}
      lendersError={lendersError}
      requestingId={requestingId}
      onRequestLender={sendLoanRequest}
      uploading={uploading}
      fileInputRef={fileInputRef}
      onUpload={uploadStatement}
      question={chatQuestion}
      messages={chatMessages}
      loading={chatLoading}
      chatError={chatError}
      onQuestionChange={setChatQuestion}
      onAskCoach={askCoach}
    />
  );
}
