import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getWaTemplates, createWaTemplate } from "@/lib/whatsappTemplates";
import { TEMPLATE_VISIBILITIES, type TemplateVisibility } from "@/lib/whatsappTemplates.shared";

// GET /api/whatsapp-templates — "any" per claude.md; RLS (`whatsapp_templates_select`)
// is the actual scoping authority (visibility + process + ownership), so this only
// gates on being signed in, same pattern as GET /api/roles and GET /api/team.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const visibilityParam = searchParams.get("visibility");
  const visibility = (TEMPLATE_VISIBILITIES as readonly string[]).includes(visibilityParam ?? "")
    ? (visibilityParam as TemplateVisibility)
    : undefined;

  const supabase = await createClient();
  try {
    const data = await getWaTemplates(supabase, {
      search: searchParams.get("search") ?? undefined,
      processId: searchParams.get("processId") ?? undefined,
      visibility,
    });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/whatsapp-templates failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to load templates." } },
      { status: 500 }
    );
  }
}

// POST /api/whatsapp-templates — create (also used for "Duplicate", which the client
// implements by posting the selected template's fields again with a modified name).
// Left open to any signed-in user (claude.md marks this route "any") — RLS's
// `whatsapp_templates_insert` (`created_by = auth.uid()`) is what actually enforces
// that a row can only ever be created as yourself.
export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const fullText = typeof body?.fullText === "string" ? body.fullText : "";
  const visibility = (TEMPLATE_VISIBILITIES as readonly string[]).includes(body?.visibility)
    ? (body.visibility as TemplateVisibility)
    : "all";
  const processId = typeof body?.processId === "string" && body.processId ? body.processId : null;

  if (!name || !fullText.trim()) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`name` and `fullText` are required." } },
      { status: 400 }
    );
  }
  if (visibility === "process" && !processId) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`processId` is required for process visibility." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const data = await createWaTemplate(supabase, { name, visibility, processId, fullText, createdBy: profile.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/whatsapp-templates failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to create template." } },
      { status: 500 }
    );
  }
}
