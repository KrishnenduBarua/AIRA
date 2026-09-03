import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n";

// Opening sequence for the public landing page: a brand sting, three short
// beats explaining what AIRA does, then a title card with the way in.
//
// Rules it follows so it never becomes an obstacle:
//   • always skippable (button, Esc, or clicking the backdrop on the title card)
//   • the full run plays once per browser; repeat visits get a ~1.3s sting
//   • prefers-reduced-motion goes straight to the static title card
const SEEN_KEY = "aira_intro_seen";

const BEATS = [
  { id: "beat1", at: 2400 },
  { id: "beat2", at: 4500 },
  { id: "beat3", at: 6600 },
];
const TITLE_AT = 8600;
// The title card holds just long enough to read, then hands over on its own.
// The button stays for anyone who would rather not wait.
const TITLE_HOLD = 1900;

function prefersCalm() {
  return Boolean(
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
  );
}

function hasSeen() {
  // Private mode can throw on access, which must never block the page.
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* the intro simply plays again next time */
  }
}

export default function IntroSequence({ onDone }) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState("logo");
  const [leaving, setLeaving] = useState(false);
  const timers = useRef([]);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    markSeen();
    setLeaving(true);
    // Matches the fade in .intro-overlay.is-leaving.
    setTimeout(() => onDone?.(), 520);
  }, [onDone]);

  useEffect(() => {
    const calm = prefersCalm();
    const seen = hasSeen();
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));

    if (calm) {
      setPhase("title");
      at(900, finish);
    } else if (seen) {
      // Returning visitors — including anyone using the Home link in the app
      // header — get a brief sting, not the whole trailer again.
      at(850, () => setPhase("title"));
      at(850 + 600, finish);
    } else {
      BEATS.forEach((beat) => at(beat.at, () => setPhase(beat.id)));
      at(TITLE_AT, () => setPhase("title"));
      at(TITLE_AT + TITLE_HOLD, finish);
    }

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [finish]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish();
      if ((event.key === "Enter" || event.key === " ") && phase === "title") {
        finish();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.classList.add("intro-open");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("intro-open");
    };
  }, [finish, phase]);

  const beats = [
    ["beat1", "◈", t("intro.beat1Title"), t("intro.beat1Body")],
    ["beat2", "◎", t("intro.beat2Title"), t("intro.beat2Body")],
    ["beat3", "✦", t("intro.beat3Title"), t("intro.beat3Body")],
  ];

  const progress =
    phase === "logo"
      ? 12
      : phase === "beat1"
        ? 34
        : phase === "beat2"
          ? 56
          : phase === "beat3"
            ? 78
            : 100;

  return (
    <div
      className={`intro-overlay${leaving ? " is-leaving" : ""}`}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={t("intro.label")}
      onClick={(event) => {
        // Only once the title card is up, so a stray click never eats the
        // sequence the visitor is still watching.
        if (phase !== "title") return;
        if (event.target.closest("button")) return;
        finish();
      }}
    >
      <div className="intro-glow" aria-hidden="true" />
      <div className="intro-grid" aria-hidden="true" />

      <div className="intro-stage">
        <section
          className={`intro-act intro-act-logo${phase === "logo" ? " is-active" : ""}`}
        >
          <span className="intro-mark" aria-hidden="true">
            A<i />
          </span>
          <p className="intro-studio">{t("intro.studio")}</p>
        </section>

        {beats.map(([id, icon, title, body]) => (
          <section
            key={id}
            className={`intro-act intro-act-beat${phase === id ? " is-active" : ""}`}
          >
            <span className="intro-beat-icon" aria-hidden="true">
              {icon}
            </span>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}

        <section
          className={`intro-act intro-act-title${phase === "title" ? " is-active" : ""}`}
        >
          <span className="intro-wordmark" aria-hidden="true">
            AIRA
          </span>
          <p className="intro-tagline">{t("intro.tagline")}</p>
          <button type="button" className="intro-start" onClick={finish}>
            {t("intro.enter")}
            <span aria-hidden="true">↗</span>
          </button>
        </section>
      </div>

      <button type="button" className="intro-skip" onClick={finish}>
        {t("intro.skip")}
        <span aria-hidden="true">▸</span>
      </button>

      <div className="intro-progress" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
