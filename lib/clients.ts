import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { rangeOverflow, escapeFilterValue, formatDisplayDate, type Pagination } from "@/lib/format";
import type { JobRow } from "@/lib/jobs";

type JobStatus = Database["public"]["Enums"]["job_status"];

// Mirrors lib/mock/clients.ts's MockClient, plus the two derived columns the list
// shows (`activeJobs`, `accountManager`).
export type ClientRow = {
  id: string;
  company: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  accountManagerId: string | null;
  accountManager: string | null;
  activeJobs: number;
  totalJobs: number;
  createdOn: string;
  createdAt: string;
};

export type ClientDetail = ClientRow & {
  jobs: Pick<JobRow, "id" | "title" | "status" | "openings" | "createdOn" | "applicationCount">[];
};

// `jobs(id, status)` rather than PostgREST's `jobs(count)` aggregate: the list needs
// *open* jobs only, and an embedded count can't be filtered without an inner join —
// which would drop every client that has no open jobs off the list entirely.
const CLIENT_SELECT = `
  id, company, contact_name, email, phone, industry, created_at, account_manager_id,
  manager:users!clients_account_manager_id_fkey(id, name),
  jobs(id, title, status, openings, created_at, applications(count))
`;

type RawClient = {
  id: string;
  company: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  created_at: string;
  account_manager_id: string | null;
  manager: { id: string; name: string } | null;
  jobs:
    | {
        id: string;
        title: string;
        status: JobStatus;
        openings: number;
        created_at: string;
        applications: { count: number }[] | null;
      }[]
    | null;
};

function toClientRow(c: RawClient): ClientRow {
  const jobs = c.jobs ?? [];
  return {
    id: c.id,
    company: c.company,
    contactName: c.contact_name,
    email: c.email,
    phone: c.phone,
    industry: c.industry,
    accountManagerId: c.account_manager_id,
    accountManager: c.manager?.name ?? null,
    // "Active" means open — on_hold and closed jobs are deliberately excluded.
    activeJobs: jobs.filter((j) => j.status === "open").length,
    totalJobs: jobs.length,
    createdOn: formatDisplayDate(c.created_at),
    createdAt: c.created_at,
  };
}

export async function getClientRows(
  supabase: SupabaseClient<Database>,
  options: { search?: string; pagination: Pagination }
): Promise<{ rows: ClientRow[]; total: number }> {
  let query = supabase.from("clients").select(CLIENT_SELECT, { count: "exact" });

  if (options.search?.trim()) {
    const term = escapeFilterValue(options.search);
    if (term) query = query.or(`company.ilike.%${term}%,contact_name.ilike.%${term}%,industry.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order("company", { ascending: true })
    .range(options.pagination.from, options.pagination.to)
    .returns<RawClient[]>();
  const overflow = rangeOverflow(error);
  if (overflow) return { rows: [], total: overflow.total };
  if (error) throw error;

  return { rows: (data ?? []).map(toClientRow), total: count ?? 0 };
}

export async function getClientDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<ClientDetail | null> {
  const { data, error } = await supabase.from("clients").select(CLIENT_SELECT).eq("id", id).maybeSingle<RawClient>();
  if (error) throw error;
  if (!data) return null;

  const jobs = [...(data.jobs ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      openings: j.openings,
      createdOn: formatDisplayDate(j.created_at),
      applicationCount: j.applications?.[0]?.count ?? 0,
    }));

  return { ...toClientRow(data), jobs };
}
