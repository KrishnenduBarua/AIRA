import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../api";
import { useLanguage } from "../i18n";
import LenderDashboardView from "./LenderDashboardView";

const PAGE_SIZE = 8;

export default function LenderDashboard({ session, onLogout }) {
  const { t, language } = useLanguage();

  const [borrowerId, setBorrowerId] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [scoreError, setScoreError] = useState("");

  const [loanRequests, setLoanRequests] = useState([]);
  const [requestsState, setRequestsState] = useState("loading");
  const [requestError, setRequestError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [decisionDraft, setDecisionDraft] = useState(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [deciding, setDeciding] = useState(false);

  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatGrounding, setChatGrounding] = useState("");

  const resetDetail = useCallback(() => {
    setSelectedRequest(null);
    setRequestDetail(null);
    setDetailError("");
    setScoreData(null);
    setBorrowerId("");
    setChatQuestion("");
    setChatMessages([]);
    setChatError("");
    setChatGrounding("");
    setDecisionDraft(null);
    setDecisionReason("");
    setDecisionError("");
  }, []);

  useEffect(() => {
    const handleHistoryChange = () => {
      if (!new URLSearchParams(window.location.search).get("request")) {
        resetDetail();
      }
    };
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, [resetDetail]);

  const loadLoanRequests = useCallback(async (mode = "initial") => {
    setRequestsState(mode === "initial" ? "loading" : "refreshing");
    try {
      const data = await request("/loans/requests");
      setLoanRequests(data.requests || []);
      setRequestError("");
      setRequestsState("ready");
    } catch (error) {
      setRequestError(error.message);
      setRequestsState("error");
    }
  }, []);

  useEffect(() => {
    loadLoanRequests();
  }, [loadLoanRequests]);

  // Filtering happens client-side over an already-fetched inbox; the visible
  // slice keeps long lists cheap to render on low-end phones.
  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return loanRequests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!term) return true;
      return (
        String(item.borrowerName || "").toLowerCase().includes(term) ||
        String(item.borrowerPhone || "").toLowerCase().includes(term)
      );
    });
  }, [loanRequests, statusFilter, search]);

  const pendingCount = useMemo(
    () => loanRequests.filter((item) => item.status === "pending").length,
    [loanRequests],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, search]);

  const loadChatHistory = useCallback(async (subjectId) => {
    setChatHistoryLoading(true);
    try {
      const history = await request(
        `/chat/lender/history?subjectUserId=${encodeURIComponent(subjectId)}`,
      );
      setChatMessages(history.messages || []);
      setChatError("");
    } catch (_error) {
      setChatMessages([]);
    } finally {
      setChatHistoryLoading(false);
    }
  }, []);

  const openRequest = useCallback(
    async (requestId, { push = true } = {}) => {
      if (push) {
        window.history.pushState(
          { view: "borrower", requestId },
          "",
          `?view=borrower&request=${encodeURIComponent(requestId)}`,
        );
      }
      setSelectedRequest(requestId);
      setRequestDetail(null);
      setDetailError("");
      setDetailLoading(true);
      setDecisionDraft(null);
      setDecisionReason("");
      setDecisionError("");

      try {
        const detail = await request(`/loans/requests/${requestId}`);
        setRequestDetail(detail);
        setBorrowerId(detail.borrower.id);
        setScoreData(detail.score);
        await loadChatHistory(detail.borrower.id);
      } catch (error) {
        setDetailError(error.message);
      } finally {
        setDetailLoading(false);
      }
    },
    [loadChatHistory],
  );

  const submitDecision = async () => {
    if (!selectedRequest || !decisionDraft) return;
    const reason = decisionReason.trim();
    if (reason.length < 10) {
      setDecisionError(t("lender.reasonTooShort"));
      return;
    }

    setDeciding(true);
    setDecisionError("");
    try {
      await request(`/loans/requests/${selectedRequest}/decision`, {
        method: "POST",
        body: JSON.stringify({ status: decisionDraft, reason }),
      });
      setDecisionDraft(null);
      setDecisionReason("");
      await loadLoanRequests("refresh");
      await openRequest(selectedRequest, { push: false });
    } catch (error) {
      // The typed reason is preserved so a failed save is never retyped.
      setDecisionError(error.message);
    } finally {
      setDeciding(false);
    }
  };

  const loadBorrowerScore = async () => {
    if (!borrowerId.trim()) {
      setScoreError(t("lender.lookupHelp"));
      return;
    }
    setLoadingScore(true);
    setScoreError("");
    setChatMessages([]);
    setChatError("");
    try {
      const data = await request(`/lender/score/${borrowerId.trim()}`);
      setScoreData(data);
      await loadChatHistory(borrowerId.trim());
    } catch (error) {
      setScoreData(null);
      setScoreError(error.message);
    } finally {
      setLoadingScore(false);
    }
  };

  const askCoach = async (event) => {
    event?.preventDefault();
    const asked = chatQuestion.trim();
    if (!asked) return;
    if (!scoreData) {
      setChatError(t("chat.noScoreLender"));
      return;
    }

    setChatLoading(true);
    setChatError("");
    const optimistic = [...chatMessages, { role: "user", content: asked }];
    setChatMessages(optimistic);
    setChatQuestion("");

    try {
      const data = await request("/chat/lender", {
        method: "POST",
        body: JSON.stringify({
          question: asked,
          language,
          subjectUserId: borrowerId,
        }),
      });
      setChatMessages(data.messages || optimistic);
      setChatGrounding(data.grounding || "");
    } catch (error) {
      setChatMessages(chatMessages);
      setChatQuestion(asked);
      setChatError(`${t("chat.failed")} ${error.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  const backToDashboard = () => {
    window.history.pushState({}, "", window.location.pathname);
    resetDetail();
  };

  return (
    <LenderDashboardView
      session={session}
      onLogout={onLogout}
      requests={filteredRequests}
      totalRequests={loanRequests.length}
      requestsState={requestsState}
      pendingCount={pendingCount}
      requestError={requestError}
      onRefreshRequests={() => loadLoanRequests("refresh")}
      onOpenRequest={openRequest}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      search={search}
      onSearchChange={setSearch}
      visibleCount={visibleCount}
      onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
      borrowerId={borrowerId}
      onBorrowerIdChange={setBorrowerId}
      loadingScore={loadingScore}
      scoreError={scoreError}
      scoreData={scoreData}
      onLoadScore={loadBorrowerScore}
      selectedRequest={selectedRequest}
      requestDetail={requestDetail}
      detailLoading={detailLoading}
      detailError={detailError}
      onBack={backToDashboard}
      onRetryDetail={() =>
        selectedRequest && openRequest(selectedRequest, { push: false })
      }
      decisionDraft={decisionDraft}
      onDecisionDraftChange={setDecisionDraft}
      decisionReason={decisionReason}
      onDecisionReasonChange={setDecisionReason}
      decisionError={decisionError}
      deciding={deciding}
      onSubmitDecision={submitDecision}
      question={chatQuestion}
      messages={chatMessages}
      chatError={chatError}
      chatLoading={chatLoading}
      chatHistoryLoading={chatHistoryLoading}
      chatGrounding={chatGrounding}
      onQuestionChange={setChatQuestion}
      onAskCoach={askCoach}
      onRetryChat={() => askCoach()}
    />
  );
}
