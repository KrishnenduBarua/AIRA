import { lazy, Suspense } from "react";
import { useLanguage } from "../i18n";
import { Card, Skeleton } from "../ui/primitives";

const ChatPanel = lazy(() => import("./ChatPanel"));

export default function ChatWidget({ open, onOpen, onClose, mode, ...chatProps }) {
  const { t } = useLanguage();
  const title = t(mode === "lender" ? "chat.lenderTitle" : "chat.borrowerTitle");

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("chat.open")}
          title={t("chat.open")}
          className="aira-chat-launcher fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-brand-700 p-1 shadow-[0_12px_30px_rgba(20,106,85,0.28)] transition hover:scale-105 hover:bg-brand-800 focus-visible:scale-105 sm:bottom-7 sm:right-7"
        >
          <img
            src="/favicon.ico"
            alt=""
            width="56"
            height="56"
            className="h-full w-full rounded-full bg-white object-cover p-1"
          />
          <span className="sr-only">{title}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 max-h-[calc(100vh-1rem)] sm:bottom-6 sm:left-auto sm:right-6 sm:w-[min(27rem,calc(100vw-3rem))]">
          <div className="max-h-[calc(100vh-1rem)] overflow-y-auto rounded-2xl shadow-[0_20px_60px_rgba(18,62,48,0.24)] sm:max-h-[calc(100vh-3rem)]">
            <Suspense
              fallback={
                <Card className="border-brand-200 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="mt-4 h-48 w-full" />
                </Card>
              }
            >
              <ChatPanel embedded mode={mode} onClose={onClose} {...chatProps} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
