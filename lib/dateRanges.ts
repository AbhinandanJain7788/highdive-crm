// IST-anchored date range resolution shared by Dashboard and Analytics — both screens'
// range tabs ("Today", "Y'day", "Last 7 Days", "Last 30 Days") need the same day-boundary
// math the rest of this codebase already uses for "today" (lib/followups.ts's
// endOfTodayIstUtc, lib/format.ts's formatDisplayDateTime) — India wall-clock days,
// expressed as UTC instant bounds so the query stays correct regardless of the server
// process's own timezone.
import "server-only";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type DashboardRangeKey = "today" | "yesterday" | "last7" | "last30";
export const DASHBOARD_RANGE_KEYS: DashboardRangeKey[] = ["today", "yesterday", "last7", "last30"];

// Analytics never offered a Y'day tab in the signed-off HTML (AnalyticsRange = "Today" |
// "Last 7 Days" | "Last 30 Days") — kept as a distinct, smaller key set rather than
// silently accepting "yesterday" on a screen that never exposed it.
export type AnalyticsRangeKey = "today" | "last7" | "last30";
export const ANALYTICS_RANGE_KEYS: AnalyticsRangeKey[] = ["today", "last7", "last30"];

export type RangeBounds = { from: string; to: string };

// Start of the IST calendar day `daysAgo` days before today, as a UTC instant.
function istDayStartUtc(daysAgo: number): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysAgo, 0, 0, 0, 0);
  return new Date(istMidnight - IST_OFFSET_MS);
}

// End of the IST calendar day `daysAgo` days before today (23:59:59.999), as a UTC instant.
function istDayEndUtc(daysAgo: number): Date {
  return new Date(istDayStartUtc(daysAgo - 1).getTime() - 1);
}

// "Last 7 Days" / "Last 30 Days" are inclusive windows ending today (today + 6/29
// preceding days) — a decision call documented in claude.md's Phase 6 As-Built Notes,
// since the phase spec doesn't pin down inclusivity either way.
export function resolveDashboardRange(key: DashboardRangeKey): RangeBounds {
  switch (key) {
    case "today":
      return { from: istDayStartUtc(0).toISOString(), to: istDayEndUtc(0).toISOString() };
    case "yesterday":
      return { from: istDayStartUtc(1).toISOString(), to: istDayEndUtc(1).toISOString() };
    case "last7":
      return { from: istDayStartUtc(6).toISOString(), to: istDayEndUtc(0).toISOString() };
    case "last30":
      return { from: istDayStartUtc(29).toISOString(), to: istDayEndUtc(0).toISOString() };
  }
}

export function resolveAnalyticsRange(key: AnalyticsRangeKey): RangeBounds {
  return resolveDashboardRange(key);
}

export function isDashboardRangeKey(v: string | null): v is DashboardRangeKey {
  return DASHBOARD_RANGE_KEYS.includes(v as DashboardRangeKey);
}

export function isAnalyticsRangeKey(v: string | null): v is AnalyticsRangeKey {
  return ANALYTICS_RANGE_KEYS.includes(v as AnalyticsRangeKey);
}

// Chart bucketing granularity for Call Trends / Talk Time: hourly within a single day,
// daily across a multi-day window — mirrors the source HTML's own 24-hour axis for its
// (hard-coded) single-day chart, extended sensibly to the two multi-day ranges.
export type ChartBucket = { label: string; from: string; to: string };

export function buildChartBuckets(key: AnalyticsRangeKey): ChartBucket[] {
  if (key === "today") {
    const dayStart = istDayStartUtc(0).getTime();
    return Array.from({ length: 24 }, (_, h) => {
      const from = new Date(dayStart + h * 60 * 60 * 1000);
      const to = new Date(dayStart + (h + 1) * 60 * 60 * 1000 - 1);
      return { label: `${h}h`, from: from.toISOString(), to: to.toISOString() };
    });
  }
  const days = key === "last7" ? 7 : 30;
  return Array.from({ length: days }, (_, i) => {
    const daysAgo = days - 1 - i;
    const from = istDayStartUtc(daysAgo);
    const to = istDayEndUtc(daysAgo);
    const ist = new Date(from.getTime() + IST_OFFSET_MS);
    const label = `${String(ist.getUTCDate()).padStart(2, "0")}/${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
    return { label, from: from.toISOString(), to: to.toISOString() };
  });
}

export function pct(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}
