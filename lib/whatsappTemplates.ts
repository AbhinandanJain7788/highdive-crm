import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { escapeFilterValue } from "@/lib/format";
import { previewFor, type TemplateVisibility, type WaTemplateRow } from "@/lib/whatsappTemplates.shared";

export type { TemplateVisibility, WaTemplateRow } from "@/lib/whatsappTemplates.shared";

type WaTemplateInsert = Database["public"]["Tables"]["whatsapp_templates"]["Insert"];
type WaTemplateUpdate = Database["public"]["Tables"]["whatsapp_templates"]["Update"];

type RawTemplate = {
  id: string;
  name: string;
  visibility: TemplateVisibility;
  process_id: string | null;
  full_text: string;
  created_by: string | null;
  created_at: string;
};

const TEMPLATE_COLUMNS = "id, name, visibility, process_id, full_text, created_by, created_at";

async function resolveUserNames(
  supabase: SupabaseClient<Database>,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("users").select("id, name").in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.id, u.name]));
}

function toRow(t: RawTemplate, names: Map<string, string>): WaTemplateRow {
  return {
    id: t.id,
    name: t.name,
    visibility: t.visibility,
    processId: t.process_id,
    fullText: t.full_text,
    preview: previewFor(t.full_text),
    createdById: t.created_by,
    createdByName: t.created_by ? names.get(t.created_by) ?? null : null,
    createdAt: t.created_at,
  };
}

export type WaTemplateListOptions = {
  search?: string;
  processId?: string;
  visibility?: TemplateVisibility;
};

// RLS (`whatsapp_templates_select`) already restricts rows to: visibility='all',
// visibility='process' matching the caller's own process, visibility='private' owned
// by the caller, or a view_all_records holder — so this query never needs to
// re-derive process scoping in application code, same convention as v_allocations.
export async function getWaTemplates(
  supabase: SupabaseClient<Database>,
  options: WaTemplateListOptions = {}
): Promise<WaTemplateRow[]> {
  let query = supabase.from("whatsapp_templates").select(TEMPLATE_COLUMNS).order("created_at", { ascending: false });

  if (options.search?.trim()) {
    const term = escapeFilterValue(options.search);
    if (term) query = query.ilike("name", `%${term}%`);
  }
  if (options.processId) query = query.eq("process_id", options.processId);
  if (options.visibility) query = query.eq("visibility", options.visibility);

  const { data, error } = await query.returns<RawTemplate[]>();
  if (error) throw error;

  const rows = data ?? [];
  const names = await resolveUserNames(supabase, rows.map((r) => r.created_by));
  return rows.map((r) => toRow(r, names));
}

export async function createWaTemplate(
  supabase: SupabaseClient<Database>,
  input: { name: string; visibility: TemplateVisibility; processId: string | null; fullText: string; createdBy: string }
): Promise<WaTemplateRow> {
  const insert: WaTemplateInsert = {
    name: input.name,
    visibility: input.visibility,
    process_id: input.visibility === "process" ? input.processId : null,
    full_text: input.fullText,
    created_by: input.createdBy,
  };
  const { data, error } = await supabase.from("whatsapp_templates").insert(insert).select(TEMPLATE_COLUMNS).single();
  if (error) throw error;
  const names = await resolveUserNames(supabase, [data.created_by]);
  return toRow(data as RawTemplate, names);
}

export async function updateWaTemplate(
  supabase: SupabaseClient<Database>,
  id: string,
  patch: { name?: string; visibility?: TemplateVisibility; processId?: string | null; fullText?: string }
): Promise<WaTemplateRow> {
  const update: WaTemplateUpdate = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.fullText !== undefined) update.full_text = patch.fullText;
  if (patch.visibility !== undefined) {
    update.visibility = patch.visibility;
    update.process_id = patch.visibility === "process" ? patch.processId ?? null : null;
  }

  const { data, error } = await supabase
    .from("whatsapp_templates")
    .update(update)
    .eq("id", id)
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw error;
  const names = await resolveUserNames(supabase, [data.created_by]);
  return toRow(data as RawTemplate, names);
}

export async function deleteWaTemplate(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
  if (error) throw error;
}
