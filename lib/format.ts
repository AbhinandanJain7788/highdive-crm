import "server-only";
import { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/candidates.shared";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Renders a timestamp or date column as "28 Aug 2026" — the exact display format
// the signed-off UI used for its mock `createdOn` strings, so a row coming out of
// the DB drops straight into the existing markup.
export function formatDisplayDate(value: string | null): string {
  if (!value) return "--";
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return "--";
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Every list endpoint takes `search`, `page`, `pageSize` and returns {data, total}
// (claude.md > Conventions). The UI offers 10/25/50; anything else is clamped so a
// hand-crafted ?pageSize=100000 can't turn a list route into a full-table dump.
// Defined in the client-safe module so the page-size selector reads the same list.
export { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/candidates.shared";

export type Pagination = { page: number; pageSize: number; from: number; to: number };

export function readPagination(searchParams: URLSearchParams): Pagination {
  const rawPage = Number(searchParams.get("page"));
  const rawSize = Number(searchParams.get("pageSize"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

// Phone numbers are stored with the seed's display spacing ("+91 98201 34567"), so a
// plain ilike on "9820134567" finds nothing. Postgres can't normalize the column
// mid-query through PostgREST, so a digits-only search becomes a pattern requiring
// those digits in order with anything between them — which, on a column that only
// ever holds digits, spaces and a leading +, is exactly a partial-number match.
// TODO(phase-7): replace with a generated `phone_digits` column + index once a
// migration path for DDL exists; that makes this exact rather than order-based.
export function phoneSearchPattern(query: string): string | null {
  const digits = query.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return `%${digits.split("").join("%")}%`;
}

// PostgREST reads `,` and `.` inside an or() filter as syntax; a search term
// containing them would otherwise change the shape of the query.
export function escapeFilterValue(value: string): string {
  return value.replace(/[,.()]/g, " ").trim();
}

// Assigns a trimmed string — or an explicit null — onto a typed table Update object,
// leaving the key absent entirely when the caller supplied neither. That's what keeps
// a PATCH partial: only the fields actually sent are written, and "" clears a
// nullable column instead of storing an empty string.
export function assignNullableText<T extends object, K extends keyof T>(
  patch: T,
  key: K,
  value: unknown
): void {
  if (value === null) patch[key] = null as T[K];
  else if (typeof value === "string") patch[key] = (value.trim() || null) as T[K];
}
