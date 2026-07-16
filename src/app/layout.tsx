import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "NAM Dashboard",
  description: "Personal mining operations dashboard foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar" aria-label="Primary navigation">
            <div className="brand">
              <span className="brand-mark">NAM</span>
              <span>Dashboard</span>
            </div>
            <nav className="nav-list">
              <Link href="/">Dashboard</Link>
              <Link href="/equipment">Equipment</Link>
              <Link href="/daily-logs">Daily Logs</Link>
              <Link href="/day-view">Day View</Link>
              <Link href="/stop-cards">STOP Cards</Link>
              <Link href="/daily-inspections">Daily Inspections</Link>
              <Link href="/operational-safety-checklists">Safety Checklists</Link>
              <Link href="/equipment-fuel-events">Fuel Events</Link>
              <Link href="/defect-tracking">Defect Tracking</Link>
              <Link href="/work-schedule">Work Schedule</Link>
              <Link href="/timesheets">Timesheets</Link>
              <Link href="/shift-reports">Shift Reports</Link>
              <Link href="/work-authorizations">Work Authorizations</Link>
            </nav>
          </aside>
          <div className="content-shell">{children}</div>
        </div>
      </body>
    </html>
  );
}
