import { useEffect, useRef } from "react";
import MarkdownResponse from "./MarkdownResponse";
import { useLanguage } from "../i18n";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
  TextArea,
} from "../ui/primitives";

// One chat surface for both audiences. The mode only changes the copy, the
// suggestions, and which disclaimer is shown — never the safety posture.
export default function ChatPanel({
  mode,
  available,
  question,
  messages,
  loading,
  historyLoading,
  error,
  grounding,
  onQuestionChange,
  onSubmit,
  onRetry,
}) {
  const { t } = useLanguage();
  const isBorrower = mode === "borrower";
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = t(
    isBorrower ? "chat.borrowerSuggestions" : "chat.lenderSuggestions",
  );

  useEffect(() => {
    // Keep the newest message in view without yanking the whole page.
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, loading]);

  const useSuggestion = (text) => {
    onQuestionChange(text);
    inputRef.current?.focus();
  };

  return (
    <Card>
      <CardHeader
        eyebrow={t(isBorrower ? "chat.borrowerTitle" : "chat.lenderTitle")}
        description={t(isBorrower ? "chat.borrowerIntro" : "chat.lenderIntro")}
        actions={
          grounding ? (
            <Badge tone="info">
              {t("chat.grounding.label")}: {t(`chat.grounding.${grounding}`)}
            </Badge>
          ) : null
        }
      />

      {!isBorrower && (
        <Alert variant="warning" className="mt-4">
          {t("chat.lenderDisclaimer")}
        </Alert>
      )}

      {error && (
        <Alert
          variant="error"
          className="mt-4"
          action={
            onRetry ? (
              <Button variant="secondary" onClick={onRetry}>
                {t("common.retry")}
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      )}

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t(isBorrower ? "chat.borrowerTitle" : "chat.lenderTitle")}
        className="mt-4 max-h-[22rem] min-h-[9rem] space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 sm:max-h-[26rem] sm:p-4"
      >
        {historyLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="ml-auto h-10 w-3/5" />
          </div>
        ) : messages.length ? (
          messages.map((message, index) => (
            <div
              key={message.id || `${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "ml-4 rounded-xl bg-brand-100 p-3 sm:ml-10"
                  : "mr-4 rounded-xl border border-slate-200 bg-white p-3 sm:mr-10"
              }
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {message.role === "user" ? t("chat.you") : t("chat.assistant")}
              </p>
              <div className="break-words">
                <MarkdownResponse>{message.content}</MarkdownResponse>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon="?"
            title={t(
              available
                ? isBorrower
                  ? "chat.emptyBorrower"
                  : "chat.emptyLender"
                : isBorrower
                  ? "chat.noScore"
                  : "chat.noScoreLender",
            )}
          />
        )}
        {loading && (
          <div className="mr-4 rounded-xl border border-slate-200 bg-white p-3 sm:mr-10">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("chat.assistant")}
            </p>
            <div className="flex gap-1.5" aria-label={t("chat.sending")}>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {available && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("chat.suggested")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => useSuggestion(item)}
                disabled={loading}
                className="max-w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 disabled:opacity-60"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <TextArea
          hideLabel
          label={t("chat.placeholder")}
          rows={3}
          ref={inputRef}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={t(available ? "chat.placeholder" : "chat.placeholderDisabled")}
          disabled={!available || loading}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            {t(isBorrower ? "chat.disclaimer" : "chat.lenderDisclaimer")}
          </p>
          <Button
            type="submit"
            disabled={!available || loading || !question.trim()}
            className="sm:shrink-0"
          >
            {loading ? t("chat.sending") : t("chat.send")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
