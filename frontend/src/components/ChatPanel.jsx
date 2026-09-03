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
function ChatSizeIcon({ isExpanded }) {
  return (
    <svg
      aria-hidden="true"
      className="aira-chat-size-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isExpanded ? (
        <>
          <path d="M4 4l6 6M10 10H6M10 10V6" />
          <path d="M20 4l-6 6M14 10h4M14 10V6" />
          <path d="M4 20l6-6M10 14H6M10 14v4" />
          <path d="M20 20l-6-6M14 14h4M14 14v4" />
        </>
      ) : (
        <>
          <path d="M10 10L4 4M4 4h4M4 4v4" />
          <path d="M14 10l6-6M20 4h-4M20 4v4" />
          <path d="M10 14l-6 6M4 20h4M4 20v-4" />
          <path d="M14 14l6 6M20 20h-4M20 20v-4" />
        </>
      )}
    </svg>
  );
}

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
  embedded = false,
  onClose,
  expanded = false,
  onToggleSize,
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
    <Card
      className={
        embedded ? "overflow-hidden border-0 !p-0 !shadow-none" : undefined
      }
    >
      {embedded ? (
        <div className="flex items-start gap-3 bg-brand-700 px-4 py-3 text-white">
          <img
            src="/favicon.ico"
            alt=""
            width="40"
            height="40"
            className="h-10 w-10 shrink-0 rounded-full bg-white object-cover p-1"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {t(isBorrower ? "chat.borrowerTitle" : "chat.lenderTitle")}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-white/80">
              {t(isBorrower ? "chat.borrowerIntro" : "chat.lenderIntro")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {grounding && (
              <Badge tone="info">
                {t("chat.grounding.label")}: {t(`chat.grounding.${grounding}`)}
              </Badge>
            )}
            {onToggleSize && (
              <button
                type="button"
                onClick={onToggleSize}
                aria-expanded={expanded}
                aria-label={t(expanded ? "chat.collapse" : "chat.expand")}
                title={t(expanded ? "chat.collapse" : "chat.expand")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-white/85 transition hover:bg-white/15 hover:text-white"
              >
                <ChatSizeIcon isExpanded={expanded} />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("chat.close")}
                title={t("chat.close")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-white/85 transition hover:bg-white/15 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ) : (
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
      )}

      <div className={embedded ? "p-3 sm:p-4" : undefined}>

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
      </div>
    </Card>
  );
}
