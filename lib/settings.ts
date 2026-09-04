import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { rangeOverflow } from "@/lib/format";
import {
  GENERAL_SETTINGS_DEFAULTS,
  COMPANY_DETAILS_DEFAULTS,
  type GeneralSettings,
  type CompanyDetails,
  type ActivityLogRow,
} from "@/lib/settings.shared";

const GENERAL_KEY = "general";
const COMPANY_KEY = "company";

async function readSettingValue<T>(supabase: SupabaseClient<Database>, key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase.from("company_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (!data) return fallback;
  return { ...fallback, ...(data.value as object) } as T;
}

async function writeSettingValue<T extends object>(
  supabase: SupabaseClient<Database>,
  key: string,
  value: T,
  updatedBy: string
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("company_settings")
    .select("id")
    .eq("key", key)
    .maybeSingle();
  if (selectError) throw selectError;

  const jsonValue = value as unknown as Json;
  if (existing) {
    const { error } = await supabase
      .from("company_settings")
      .update({ value: jsonValue, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("company_settings").insert({ key, value: jsonValue, updated_by: updatedBy });
    if (error) throw error;
  }
}

export async function getGeneralSettings(supabase: SupabaseClient<Database>): Promise<GeneralSettings> {
  return readSettingValue(supabase, GENERAL_KEY, GENERAL_SETTINGS_DEFAULTS);
}

export async function updateGeneralSettings(
  supabase: SupabaseClient<Database>,
  patch: Partial<GeneralSettings>,
  updatedBy: string
): Promise<GeneralSettings> {
  const current = await getGeneralSettings(supabase);
  const next = { ...current, ...patch };
  await writeSettingValue(supabase, GENERAL_KEY, next, updatedBy);
  return next;
}

// Company Details has no real form anywhere in the signed-off HTML (`adminOtherLabels`
// only ever renders it as a "coming soon" placeholder — see settings/page.tsx's own
// note) — claude.md's own rule is "if the file and reality disagree, the UI wins," but
// this phase explicitly requires wiring the screen, so a minimal, standard company-
// details form was added rather than left unbuilt. Same class of decision as Phase 4's
// Data Management "Upload Data" step.
export async function getCompanyDetails(supabase: SupabaseClient<Database>): Promise<CompanyDetails> {
  return readSettingValue(supabase, COMPANY_KEY, COMPANY_DETAILS_DEFAULTS);
}

export async function updateCompanyDetails(
  supabase: SupabaseClient<Database>,
  patch: Partial<CompanyDetails>,
  updatedBy: string
): Promise<CompanyDetails> {
  const current = await getCompanyDetails(supabase);
  const next = { ...current, ...patch };
  await writeSettingValue(supabase, COMPANY_KEY, next, updatedBy);
  return next;
}

export async function getActivityLogs(
  supabase: SupabaseClient<Database>,
  options: { page: number; pageSize: number }
): Promise<{ rows: ActivityLogRow[]; total: number }> {
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;

  const { data, error, count } = await supabase
    .from("activity_logs")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  const overflow = rangeOverflow(error);
  if (overflow) return { rows: [], total: overflow.total };
  if (error) throw error;

  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: users, error: usersError } = await supabase.from("users").select("id, name").in("id", actorIds);
    if (usersError) throw usersError;
    for (const u of users ?? []) names.set(u.id, u.name);
  }

  return {
    rows: rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_id ? names.get(r.actor_id) ?? null : null,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: r.metadata as Record<string, unknown> | null,
      createdAt: r.created_at,
    })),
    total: count ?? 0,
  };
}
