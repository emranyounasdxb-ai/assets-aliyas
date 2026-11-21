"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Buildings,
  Car,
  ChartBar,
  ChartPieSlice,
  Check,
  CheckCircle,
  FileText,
  FolderOpen,
  Gear,
  Key,
  List,
  MagnifyingGlass,
  Question,
  SignOut,
  SquaresFour,
  Users,
  Wallet,
  X,
} from "@phosphor-icons/react";
import {
  daysUntil,
  dateLabel,
  visibleNotifications,
  type AppData,
} from "@/lib/domain";
import { AppProvider, useApp } from "./provider";
import { Avatar, Button, Modal, Money, SearchInput } from "./ui";
import { Brand } from "./brand";
const mainNav = [
  { href: "/", label: "Overview", icon: SquaresFour },
  { href: "/properties", label: "Properties", icon: Buildings },
  { href: "/units", label: "Flats", icon: Key },
  { href: "/parking", label: "Parking", icon: Car },
  { href: "/tenants", label: "Tenants", icon: Users },
];
const financeNav = [
  { href: "/agreements", label: "Agreements", icon: FileText },
  { href: "/cheques", label: "Cheques", icon: Wallet },
  { href: "/wallets", label: "Tenant accounts", icon: ChartPieSlice },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/reports", label: "Reports", icon: ChartBar },
];
export function AppShell({
  data,
  children,
}: {
  data: AppData;
  children: ReactNode;
}) {
  return (
    <AppProvider data={data}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const { data, mutate, notify } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [guide, setGuide] = useState(false);
  const nav = [...mainNav, ...financeNav];
  const current = nav.find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
  );
  const activeNotices = visibleNotifications(data);
  const unread = activeNotices.filter(
    (n) => !data.readNotifications.includes(n.id),
  );
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") setMobile(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1000px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const old = document.body.style.overflow;
    const previous = document.activeElement as HTMLElement | null;
    const main = document.querySelector<HTMLElement>(".workspace-main");
    if (main) main.inert = true;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLAnchorElement>(".sidebar a")?.focus();
    return () => {
      document.body.style.overflow = old;
      if (main) main.inert = false;
      previous?.focus();
    };
  }, [mobile]);
  const term = query.toLowerCase().trim();
  const results = [
    ...data.buildings.map((b) => ({
      id: b.id,
      title: b.name,
      detail: `Property · ${b.area}`,
      href: `/properties/${b.id}`,
      icon: Buildings,
    })),
    ...data.tenants.map((t) => ({
      id: t.id,
      title: t.name,
      detail: `Tenant · ${t.email || t.phone}`,
      href: `/tenants/${t.id}`,
      icon: Users,
    })),
    ...data.units.map((u) => ({
      id: u.id,
      title: `Flat ${u.code}`,
      detail: `${data.buildings.find((b) => b.id === u.building_id)?.name} · ${u.category}`,
      href: `/properties/${u.building_id}`,
      icon: Key,
    })),
    ...data.leases.map((l) => ({
      id: l.id,
      title: l.reference,
      detail: "Rental agreement",
      href: `/agreements/${l.id}`,
      icon: FileText,
    })),
  ]
    .filter(
      (r) => !term || `${r.title} ${r.detail}`.toLowerCase().includes(term),
    )
    .slice(0, 10);
  async function signOut() {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/login");
      router.refresh();
    } catch {
      notify("Could not sign out. Please try again.");
    }
  }
  const links = (items: typeof mainNav) =>
    items.map((item) => (
      <Link
        href={item.href}
        key={item.href}
        className={`nav-link ${(item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? "active" : ""}`}
        aria-current={
          (
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          )
            ? "page"
            : undefined
        }
        onClick={() => setMobile(false)}
      >
        <item.icon
          size={20}
          weight={
            (
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            )
              ? "fill"
              : "regular"
          }
        />
        {item.label}
        {item.href === "/properties" && (
          <span className="nav-count" aria-hidden="true">
            {data.buildings.length}
          </span>
        )}
      </Link>
    ));
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {mobile && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
        aria-label="Main navigation"
        inert={narrow && !mobile}
        {...(narrow && mobile
          ? { role: "dialog", "aria-modal": true as const }
          : {})}
        onKeyDown={(event) => {
          if (!mobile || event.key !== "Tab") return;
          const items = [
            ...event.currentTarget.querySelectorAll<HTMLElement>("a,button"),
          ].filter((el) => el.offsetParent !== null);
          const first = items[0],
            last = items.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <Link
          href="/"
          className="brand"
          aria-label="Aliyas home"
          onClick={() => setMobile(false)}
        >
          <Brand />
        </Link>
        <Button
          className="mobile-close icon-button"
          variant="ghost"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </Button>
        <nav>
          {links(mainNav)}
          <div className="nav-group-gap" />
          {links(financeNav)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <button type="button" onClick={() => setGuide(true)}>
              <Question size={18} />
              Quick guide
              <ArrowRight size={15} />
            </button>
          </div>
          <Link
            href="/settings"
            className={`nav-link ${pathname === "/settings" ? "active" : ""}`}
            onClick={() => setMobile(false)}
          >
            <Gear size={20} />
            Settings
          </Link>
          <div className="sidebar-user">
            <Avatar name={data.membership.display_name} />
            <div>
              <strong>{data.membership.display_name}</strong>
              <small>
                {data.membership.role[0].toUpperCase() +
                  data.membership.role.slice(1)}
              </small>
            </div>
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Sign out"
              onClick={signOut}
            >
              <SignOut size={18} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              variant="ghost"
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <List size={23} />
            </Button>
            <strong>
              {current?.label ??
                (pathname === "/settings" ? "Settings" : "Details")}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="global-search"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <MagnifyingGlass size={18} />
              <span>Search anything…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="topbar-divider" />
            <Button
              variant="ghost"
              className="icon-button notification-button"
              aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
              onClick={() => setNotifications(true)}
            >
              <Bell size={21} />
              {unread.length > 0 && <span className="notification-indicator" />}
            </Button>
            <Link href="/settings" aria-label="Account settings">
              <Avatar name={data.membership.display_name} size="small" />
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {data.workspace.is_demo && (
            <div className="demo-banner">
              <span>
                <span className="status-dot" />
                <strong>Demo workspace</strong>
                <span className="demo-extra">
                  Fictional properties and tenants. Your changes are saved
                  locally.
                </span>
              </span>
              <Link href="/settings">
                Set up your portfolio
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>
      {search && (
        <Modal
          title="Search your workspace"
          onClose={() => {
            setSearch(false);
            setQuery("");
          }}
        >
          <div className="search-dialog">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search names, flat numbers or references…"
            />
            <div className="search-results">
              {results.length ? (
                results.map((r) => (
                  <Link
                    key={r.id}
                    href={r.href}
                    onClick={() => {
                      setSearch(false);
                      setQuery("");
                    }}
                  >
                    <span className="result-icon">
                      <r.icon size={20} />
                    </span>
                    <div>
                      <strong>{r.title}</strong>
                      <small>{r.detail}</small>
                    </div>
                    <ArrowRight size={16} />
                  </Link>
                ))
              ) : (
                <p className="muted empty-search">
                  No records match your search.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
      {notifications && (
        <Modal
          title="Your reminders"
          description="Rental cheques due within seven days and overdue cheques."
          onClose={() => setNotifications(false)}
        >
          <div className="notifications-dialog">
            {activeNotices.length > 0 && (
              <Button
                variant="ghost"
                className="mark-read"
                onClick={async () => {
                  try {
                    await mutate("notifications_read", {
                      ids: unread.slice(0, 100).map((n) => n.id),
                    });
                    notify("Reminders marked as read.");
                  } catch (err) {
                    notify(
                      err instanceof Error
                        ? err.message
                        : "Could not update reminders",
                    );
                  }
                }}
              >
                <Check size={16} />
                Mark as read
              </Button>
            )}
            {activeNotices.slice(0, 40).map((n) => {
              const c = data.cheques.find((c) => c.id === n.cheque_id);
              if (!c) return null;
              const days = daysUntil(c.due_date);
              return (
                <Link
                  className={`notification-row ${data.readNotifications.includes(n.id) ? "" : "unread"}`}
                  key={n.id}
                  href="/cheques"
                  onClick={() => setNotifications(false)}
                >
                  <span className={`notice-icon ${days < 0 ? "late" : ""}`}>
                    <Wallet size={20} />
                  </span>
                  <div>
                    <strong>
                      {data.tenants.find((t) => t.id === c.tenant_id)?.name}
                    </strong>
                    <p>
                      Cheque {c.number} · <Money value={c.amount} />
                    </p>
                    <small>
                      {dateLabel(c.due_date)} ·{" "}
                      {days < 0
                        ? `${Math.abs(days)} days overdue`
                        : days === 0
                          ? "Due today"
                          : `Due in ${days} days`}
                    </small>
                  </div>
                  {!data.readNotifications.includes(n.id) && (
                    <span className="status-dot" />
                  )}
                </Link>
              );
            })}
            {!activeNotices.length && (
              <div className="empty-state">
                <CheckCircle size={32} />
                <h3>All caught up</h3>
                <p>No rental cheques need your attention this week.</p>
              </div>
            )}
          </div>
        </Modal>
      )}
      {guide && (
        <Modal title="Quick guide" onClose={() => setGuide(false)}>
          <div className="guide-content">
            {[
              [
                "01",
                "Add your properties",
                "Create a building and its floors, then add flats with their rent and amenities.",
              ],
              [
                "02",
                "Welcome your tenants",
                "Save contact details and keep scanned documents inside each tenant profile.",
              ],
              [
                "03",
                "Create an agreement",
                "Link a tenant to a flat and set annual rent with four or six cheques.",
              ],
              [
                "04",
                "Keep payments in view",
                "Track cheque dates, record clearance and review balances and occupancy.",
              ],
            ].map(([n, title, copy]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
            <p className="form-note">
              The account balance includes annual rent charged and existing
              opening balances. Security is always shown separately.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
