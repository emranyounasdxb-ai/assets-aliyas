"use client";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  DownloadSimple,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button {...props} className={`button ${variant} ${className}`}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Tabs({
  id,
  value,
  onChange,
  items,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div className="detail-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          id={`${id}-tab-${item.value}`}
          aria-controls={`${id}-panel-${item.value}`}
          aria-selected={value === item.value}
          tabIndex={value === item.value ? 0 : -1}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % items.length
                : event.key === "ArrowLeft"
                  ? (index - 1 + items.length) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : -1;
            if (next < 0) return;
            event.preventDefault();
            onChange(items[next].value);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next]?.focus();
          }}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Money({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  return (
    <span className="money">
      <span className="currency">AED</span>{" "}
      {new Intl.NumberFormat("en-AE", {
        maximumFractionDigits: value % 100 ? 2 : 0,
        notation: compact ? "compact" : "standard",
      }).format(value === 0 ? 0 : value / 100)}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function SectionHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Plus size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: string;
}) {
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <Button
          variant="ghost"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  const generated = useId();
  const control =
    isValidElement<{ id?: string; "aria-describedby"?: string }>(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type)
      ? children
      : null;
  const id = control?.props.id || generated;
  return (
    <div className={`field ${wide ? "span-2" : ""}`}>
      {control ? (
        <label htmlFor={id}>{label}</label>
      ) : (
        <div className="field-label" id={`${id}-label`}>
          {label}
        </div>
      )}
      {control
        ? cloneElement(control, {
            id,
            "aria-describedby": hint
              ? `${id}-hint`
              : control.props["aria-describedby"],
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <div className="inline-error" role="alert">
      {message}
    </div>
  ) : null;
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <MagnifyingGlass size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function Pagination({
  page,
  setPage,
  total,
  pageSize = 10,
}: {
  page: number;
  setPage: (page: number) => void;
  total: number;
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, total)} of ${total}`
          : "0 records"}
      </span>
      <div>
        <Button
          className="icon-button"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          <ArrowLeft size={16} />
        </Button>
        <span>
          {current} / {pages}
        </span>
        <Button
          className="icon-button"
          aria-label="Next page"
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="back-link" href={href}>
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function DocumentLink({
  id,
  name,
  download = false,
}: {
  id: string;
  name: string;
  download?: boolean;
}) {
  return (
    <a
      href={`/api/documents/${id}/file${download ? "?download=1" : ""}`}
      target="_blank"
      rel="noreferrer"
      className="text-link"
    >
      {download ? <DownloadSimple size={16} /> : null}
      {name}
    </a>
  );
}
export function SaveFooter({
  pending,
  onClose,
  label = "Save changes",
}: {
  pending: boolean;
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="modal-footer">
      <Button type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" disabled={pending}>
        {pending ? (
          "Saving…"
        ) : (
          <>
            <Check size={17} />
            {label}
          </>
        )}
      </Button>
    </div>
  );
}
export function useList<T>(
  items: T[],
  filter: (item: T) => boolean,
  pageSize = 10,
) {
  const [page, setPage] = useState(1);
  const filtered = items.filter(filter);
  const effective = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  return {
    page: effective,
    setPage,
    filtered,
    visible: filtered.slice((effective - 1) * pageSize, effective * pageSize),
    total: filtered.length,
  };
}
export function statusTone(status: string) {
  return ["Occupied", "active", "cleared", "current"].includes(status)
    ? "success"
    : ["bounced", "overdue"].includes(status)
      ? "danger"
      : ["Vacant", "received", "held"].includes(status)
        ? "mint"
        : ["Reserved", "deposited", "due_soon"].includes(status)
          ? "warning"
          : "neutral";
}
