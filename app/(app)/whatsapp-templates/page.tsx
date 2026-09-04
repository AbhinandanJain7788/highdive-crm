import { createClient } from "@/lib/supabase/server";
import { getWaTemplates } from "@/lib/whatsappTemplates";
import WhatsappTemplatesClient from "./WhatsappTemplatesClient";

// Server-renders the full unfiltered list plus the processes list for the Process
// filter dropdown; the client component refetches through /api/whatsapp-templates as
// search/process/visibility change. RLS (`whatsapp_templates_select`) scopes which
// rows come back — same convention as Allocations/Candidates.
export default async function WhatsappTemplatesPage() {
  const supabase = await createClient();
  const [templates, processesResult] = await Promise.all([
    getWaTemplates(supabase),
    supabase.from("processes").select("id, name").order("name"),
  ]);

  return <WhatsappTemplatesClient initialTemplates={templates} processes={processesResult.data ?? []} />;
}
