import { forwardRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// One place for layout, spacing, states, and touch/focus behaviour, so every
// screen looks and behaves the same. All sizing is mobile-first: the base
// styles must survive a 320px viewport without horizontal overflow.

export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

/* Lets a dashboard put its own navigation inside the shared app header, so a
   signed-in screen shows one bar rather than stacking a second one under it.
   The slot node only exists after the header commits, hence the effect. */
export function HeaderSlot({ id, children }) {
  const [node, setNode] = useState(null);

  useEffect(() => {
    setNode(document.getElementById(id));
  }, [id]);

  return node ? createPortal(children, node) : null;
}

/* ------------------------------------------------------------------ layout */

export function Page({ children, className }) {
  return <div className={cx("space-y-4 sm:space-y-6", className)}>{children}</div>;
}

// The main content / sidebar split used by every dashboard. Single column
// until there is genuinely room for two, so tablets stack rather than cramp.
export function SplitLayout({ main, aside, className }) {
  return (
    <div className={cx("grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start", className)}>
      <div className="min-w-0 space-y-4 sm:space-y-6">{main}</div>
      <div className="min-w-0 space-y-4 sm:space-y-6 lg:sticky lg:top-6">
        {aside}
      </div>
    </div>
  );
}

export function Card({ children, className, as: Tag = "section", ...rest }) {
  return (
    <Tag
      {...rest}
      className={cx(
        "aira-card min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ eyebrow, title, description, actions, id }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
            {eyebrow}
          </p>
        )}
        {title && (
          <h2
            id={id}
            className="mt-1.5 text-lg font-bold text-slate-900 sm:text-xl"
          >
            {title}
          </h2>
        )}
        {description && (
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- controls */

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:hover:bg-brand-700",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800",
  subtle:
    "border border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200",
  danger:
    "border border-red-300 bg-white text-red-700 hover:border-red-400 hover:bg-red-50",
  ghost: "text-brand-700 underline decoration-brand-300 hover:text-brand-900",
};

// min-h-11 keeps every control at a ~44px touch target on phones.
export const Button = forwardRef(function Button(
  { variant = "primary", full, className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        full && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
});

const CONTROL_CLASS =
  "w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 " +
  "placeholder:text-slate-400 outline-none transition focus:border-brand-500 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70";

let fieldCounter = 0;
function useFieldId(provided) {
  if (provided) return provided;
  fieldCounter += 1;
  return `field-${fieldCounter}`;
}

// A labelled control with help text and an error message wired up through
// aria-describedby, so screen readers announce both.
export function Field({
  id,
  label,
  help,
  error,
  required,
  children,
  className,
}) {
  const fieldId = useFieldId(id);
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("min-w-0", className)}>
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-sm font-medium text-slate-800"
      >
        {label}
        {required && (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children({
        id: fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
        className: CONTROL_CLASS,
      })}
      {help && (
        <p id={helpId} className="mt-1.5 text-xs leading-5 text-slate-500">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput(
  { label, help, error, required, id, className, ...rest },
  ref,
) {
  return (
    <Field
      label={label}
      help={help}
      error={error}
      required={required}
      id={id}
      className={className}
    >
      {(props) => <input ref={ref} {...props} {...rest} />}
    </Field>
  );
});

export const TextArea = forwardRef(function TextArea(
  { label, help, error, required, id, rows = 4, hideLabel, className, ...rest },
  ref,
) {
  return (
    <Field
      label={hideLabel ? <span className="sr-only">{label}</span> : label}
      help={help}
      error={error}
      required={required}
      id={id}
      className={className}
    >
      {(props) => (
        <textarea
          ref={ref}
          {...props}
          {...rest}
          rows={rows}
          className={cx(props.className, "min-h-24 resize-y leading-6")}
        />
      )}
    </Field>
  );
});

/* ------------------------------------------------------------------ states */

const ALERT_VARIANTS = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-green-200 bg-green-50 text-green-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

const ALERT_ICONS = {
  error: "!",
  success: "✓",
  warning: "!",
  info: "i",
};

// Errors are announced politely and can carry a recovery action, so a failure
// is never a dead end.
export function Alert({ variant = "info", title, children, action, className }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cx(
        "flex flex-col gap-3 rounded-xl border p-3 text-sm leading-6 sm:flex-row sm:items-start sm:gap-3",
        ALERT_VARIANTS[variant],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold"
      >
        {ALERT_ICONS[variant]}
      </span>
      <div className="min-w-0 flex-1 break-words">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action, icon = "○" }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-slate-400 shadow-sm"
      >
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-600">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-lg bg-slate-200", className)}
    />
  );
}

// A loading placeholder that keeps the page height stable while data arrives.
export function SkeletonList({ rows = 3, label }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ display */

const BADGE_TONES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-100 text-brand-800 ring-brand-200",
  success: "bg-green-100 text-green-800 ring-green-200",
  warning: "bg-amber-100 text-amber-900 ring-amber-200",
  danger: "bg-red-100 text-red-800 ring-red-200",
  info: "bg-sky-100 text-sky-800 ring-sky-200",
};

export function Badge({ tone = "neutral", children, className }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ value, label, tone = "brand" }) {
  const percent = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={cx(
            "h-full rounded-full transition-[width] duration-500",
            tone === "brand" ? "bg-brand-600" : "bg-amber-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {label && <p className="mt-1.5 text-xs text-slate-600">{label}</p>}
    </div>
  );
}

export function DefinitionGrid({ items, columns = 2 }) {
  return (
    <dl
      className={cx(
        "grid gap-3",
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
            {item.value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// A back link that reads as navigation rather than an action button.
export function BackLink({ children, onClick }) {
  return (
    <Button variant="secondary" onClick={onClick} className="self-start">
      <span aria-hidden="true">←</span>
      {children}
    </Button>
  );
}
