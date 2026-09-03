import { useCallback, useEffect, useState } from "react";
import { request } from "../api";
import LenderDashboardView from "./LenderDashboardView";

export default function LenderDashboard({ session, onLogout }) {
  const [borrowerId, setBorrowerId] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [loanRequests, setLoanRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  useEffect(() => {
    const handleHistoryChange = () => {
      const requestId = new URLSearchParams(window.location.search).get(
        "request",
      );
      if (!requestId) {
        setRequestDetail(null);
        setSelectedRequest(null);
        setScoreData(null);
        setBorrowerId("");
        setChatQuestion("");
        setChatMessages([]);
        setChatError("");
        setRequestError("");
      }
    };
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, []);

  const loadLoanRequests = useCallback(async () => {
    try {
      const data = await request("/loans/requests");
      setLoanRequests(data.requests || []);
      setPendingCount(data.pendingCount || 0);
      setRequestError("");
    } catch (error) {
      setRequestError(error.message);
    }
  }, []);

  useEffect(() => {
    loadLoanRequests();
  }, [loadLoanRequests]);

  const openRequest = async (requestId) => {
    window.history.pushState(
      { view: "borrower", requestId },
      "",
      `?view=borrower&request=${encodeURIComponent(requestId)}`,
    );
    setSelectedRequest(requestId);
    setRequestDetail(null);
    setRequestError("");
    setDetailLoading(true);
    try {
      const detail = await request(`/loans/requests/${requestId}`);
      setRequestDetail(detail);
      setBorrowerId(detail.borrower.id);
      setScoreData(detail.score);
      const history = await request(
        `/chat/lender/history?subjectUserId=${encodeURIComponent(detail.borrower.id)}`,
      );
      setChatMessages(history.messages || []);
      setChatError("");
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const decide = async (status) => {
    if (!selectedRequest) return;
    setDeciding(true);
    setRequestError("");
    try {
      await request(`/loans/requests/${selectedRequest}/decision`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await loadLoanRequests();
      await openRequest(selectedRequest);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setDeciding(false);
    }
  };

  const loadBorrowerScore = async () => {
    if (!borrowerId.trim()) {
      setScoreError("Enter a borrower user ID first.");
      return;
    }
    setLoadingScore(true);
    setScoreError("");
    setChatMessages([]);
    setChatError("");
    try {
      const data = await request(`/lender/score/${borrowerId.trim()}`);
      setScoreData(data);
      const history = await request(
        `/chat/lender/history?subjectUserId=${encodeURIComponent(borrowerId.trim())}`,
      );
      setChatMessages(history.messages || []);
    } catch (error) {
      setScoreData(null);
      setScoreError(error.message);
    } finally {
      setLoadingScore(false);
    }
  };

  const askCoach = async (event) => {
    event.preventDefault();
    if (!chatQuestion.trim()) return;
    if (!scoreData) {
      setChatError("Load a borrower score before asking the lender coach.");
      return;
    }
    setChatLoading(true);
    setChatError("");
    const userMessage = { role: "user", content: chatQuestion.trim() };
    const nextMessages = [...chatMessages, userMessage];
    setChatQuestion("");
    setChatMessages(nextMessages);
    try {
      const data = await request("/chat/lender", {
        method: "POST",
        body: JSON.stringify({
          question: chatQuestion,
          score: scoreData.score,
          riskLevel: scoreData.riskLevel,
          tier: scoreData.tier,
          factors: scoreData.factors || {},
          subjectUserId: borrowerId,
        }),
      });
      setChatMessages(data.messages || nextMessages);
    } catch (error) {
      setChatError(error.message);
    } finally {
      setChatLoading(false);
    }
  };

  const backToDashboard = () => {
    window.history.pushState({}, "", window.location.pathname);
    setSelectedRequest(null);
    setRequestDetail(null);
    setScoreData(null);
    setBorrowerId("");
    setChatQuestion("");
    setChatMessages([]);
    setChatError("");
    setRequestError("");
  };

  return (
    <LenderDashboardView
      session={session}
      onLogout={onLogout}
      requests={loanRequests}
      pendingCount={pendingCount}
      requestError={requestError}
      onOpenRequest={openRequest}
      borrowerId={borrowerId}
      onBorrowerIdChange={setBorrowerId}
      loadingScore={loadingScore}
      scoreError={scoreError}
      scoreData={scoreData}
      onLoadScore={loadBorrowerScore}
      question={chatQuestion}
      messages={chatMessages}
      chatError={chatError}
      chatLoading={chatLoading}
      onQuestionChange={setChatQuestion}
      onAskCoach={askCoach}
      selectedRequest={selectedRequest}
      requestDetail={requestDetail}
      detailLoading={detailLoading}
      onBack={backToDashboard}
      deciding={deciding}
      onDecision={decide}
    />
  );
}
