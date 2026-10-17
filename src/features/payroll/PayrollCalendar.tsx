"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatHours } from "./calculations";
import type { PayrollCalendarDay } from "./types";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const mobileStatusMarks: Record<PayrollCalendarDay["status"], string> = {
  RECONCILED: "✓",
  AWAITING_PAYROLL: "…",
  MISSING_TIMESHEET: "!",
  DISCREPANCY: "!",
  NEEDS_REVIEW: "?",
  OFF: "—",
};

function statusClass(status: PayrollCalendarDay["status"]) {
  return `payroll-status--${status.toLowerCase().replaceAll("_", "-")}`;
}

function longDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function PayrollCalendar({
  days,
  monthLabel,
  previousHref,
  nextHref,
}: {
  days: PayrollCalendarDay[];
  monthLabel: string;
  previousHref: string;
  nextHref: string;
}) {
  const [selected, setSelected] = useState<PayrollCalendarDay>();
  return (
    <>
      <section className="payroll-calendar-card rounded-xl border border-border bg-card shadow-xs" aria-labelledby="payroll-calendar-heading">
        <div className="payroll-calendar-toolbar">
          <div>
            <p className="eyebrow">Monday–Sunday view</p>
            <h2 id="payroll-calendar-heading">{monthLabel}</h2>
          </div>
          <div className="payroll-month-nav">
            <Link className="button secondary" href={previousHref} aria-label="Previous month"><ChevronLeft size={16} /> Previous</Link>
            <Link className="button secondary" href={nextHref} aria-label="Next month">Next <ChevronRight size={16} /></Link>
          </div>
        </div>
        <div className="payroll-calendar-weekdays" aria-hidden="true">
          {weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="payroll-calendar-grid">
          {days.map((day) => (
            <button
              className={`payroll-day ${statusClass(day.status)}${day.inMonth ? "" : " payroll-day--outside"}`}
              key={day.date}
              type="button"
              aria-label={`${longDate(day.date)}: ${day.statusLabel}`}
              onClick={() => setSelected(day)}
            >
              <span className="payroll-day-number">{day.dayNumber}</span>
              <span className="payroll-day-status">{day.statusLabel}</span>
              <span className="payroll-day-status-mark" aria-hidden="true">{mobileStatusMarks[day.status]}</span>
              {day.timesheetMinutes != null ? <span className="payroll-day-hours">{formatHours(day.timesheetMinutes)}<span className="payroll-day-hours-label"> recorded</span></span> : null}
              {day.scheduledLabel ? <span className="payroll-day-schedule subtle">{day.scheduledLabel}</span> : null}
            </button>
          ))}
        </div>
        <div className="payroll-legend" aria-label="Calendar status legend">
          <span className="payroll-status--reconciled"><i />Aggregate match</span>
          <span className="payroll-status--awaiting-payroll"><i />Awaiting payroll</span>
          <span className="payroll-status--missing-timesheet"><i />Action required</span>
          <span className="payroll-status--needs-review"><i />Needs review</span>
          <span className="payroll-status--off"><i />Off / no evidence</span>
        </div>
      </section>
      {selected ? (
        <div className="payroll-day-dialog" role="dialog" aria-modal="true" aria-labelledby="payroll-day-title" onMouseDown={(event) => event.target === event.currentTarget && setSelected(undefined)}>
          <aside className="payroll-day-drawer">
            <div className="payroll-drawer-header">
              <div><p className="eyebrow">Day detail</p><h2 id="payroll-day-title">{longDate(selected.date)}</h2></div>
              <button className="payroll-close-button" type="button" aria-label="Close day detail" onClick={() => setSelected(undefined)}><X /></button>
            </div>
            <span className={`payroll-day-status ${statusClass(selected.status)}`}>{selected.statusLabel}</span>
            <p>{selected.detail}</p>
            <dl className="payroll-detail-list">
              <div><dt>Scheduled</dt><dd>{selected.scheduledLabel ?? "No assignment"}</dd></div>
              {selected.equipmentLabel ? <div><dt>Equipment</dt><dd>{selected.equipmentLabel}</dd></div> : null}
              <div><dt>NAM Timesheet</dt><dd>{selected.timesheetMinutes == null ? "No entry" : formatHours(selected.timesheetMinutes)}</dd></div>
              <div><dt>Payroll evidence</dt><dd>{selected.paidEvidenceLabel ?? "Not imported"}</dd></div>
              {selected.payrollPeriodLabel ? <div><dt>Covered period</dt><dd>{selected.payrollPeriodLabel}</dd></div> : null}
              {selected.estimatedGross ? <div><dt>Estimated gross</dt><dd>{selected.estimatedGross}</dd></div> : null}
              {selected.estimatedGrossStatus === "UNAVAILABLE" ? <div><dt>Estimated gross</dt><dd>Unavailable — {selected.estimatedGrossReason === "RATE_EVIDENCE_CONFLICT" ? "rate evidence conflicts" : selected.estimatedGrossReason === "RATE_CHANGE_UNCERTAINTY" ? "a possible rate change has no verified effective date" : "no verified rate covers this date"}.</dd></div> : null}
            </dl>
            {selected.evidenceLevel === "aggregate" ? <div className="payroll-notice">The paycheck confirms only the period total, not this date&apos;s individual paid allocation.</div> : null}
            {selected.actionHref ? <Link className="button primary" href={selected.actionHref}>{selected.actionLabel}</Link> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
