"use client";

import {
  CalendarDays,
  ClipboardCheck,
  FileClock,
  Gauge,
  Menu,
  ShieldCheck,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { label: "Dashboard", href: "/", icon: Gauge },
  { label: "Payroll", href: "/payroll", icon: WalletCards },
  { label: "Work Schedule", href: "/work-schedule", icon: CalendarDays },
  { label: "Timesheets", href: "/timesheets", icon: FileClock },
  { label: "Daily Operations", href: "/day-view", icon: ClipboardCheck },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Safety", href: "/stop-cards", icon: ShieldCheck },
  { label: "Employees", href: "/employees", icon: Users },
] as const;

const secondaryNavigation = [
  ["Reference Data", "/reference-data"],
  ["Equipment", "/equipment"],
  ["Daily Logs", "/daily-logs"],
  ["Delay Reports", "/dragline-delay-reports"],
  ["Daily Inspections", "/daily-inspections"],
  ["Safety Checklists", "/operational-safety-checklists"],
  ["Fuel Events", "/equipment-fuel-events"],
  ["Defect Tracking", "/defect-tracking"],
  ["Shift Reports", "/shift-reports"],
  ["Work Authorizations", "/work-authorizations"],
  ["Knowledge Base", "/knowledge-base"],
] as const;

function active(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell metronic-shell">
      <button
        className="mobile-nav-trigger"
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </button>
      {open ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside className={`sidebar metronic-sidebar${open ? " sidebar--open" : ""}`} aria-label="Primary navigation" role="navigation">
        <div className="brand">
          <span className="brand-mark">NAM</span>
          <span><strong>Dashboard</strong><small>Operations console</small></span>
          <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="nav-list metronic-nav">
          {navigation.map(({ label, href, icon: Icon }) => (
            <Link className={active(pathname, href) ? "is-active" : undefined} href={href} key={href} onClick={() => setOpen(false)}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </div>
        <p className="nav-section-label">More modules</p>
        <div className="nav-list nav-list--secondary">
          {secondaryNavigation.map(([label, href]) => (
            <Link className={active(pathname, href) ? "is-active" : undefined} href={href} key={href} onClick={() => setOpen(false)}>{label}</Link>
          ))}
        </div>
      </aside>
      <div className="main-shell">
        <header className="app-topbar">
          <div><span className="topbar-kicker">Private workspace</span><strong>NAM Operations</strong></div>
          <span className="private-access-pill"><ShieldCheck aria-hidden="true" /> Tailscale private</span>
        </header>
        <div className="content-shell">{children}</div>
      </div>
    </div>
  );
}
