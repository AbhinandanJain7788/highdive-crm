import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getClientDetail } from "@/lib/clients";
import { assignNullableText } from "@/lib/format";
import type { Database } from "@/types/supabase";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/clients/:id — contact block plus every job with this client.
export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_clients");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = await createClient();
  try {
    const client = await getClientDetail(supabase, id);
    if (!client) {
      return NextResponse.json({ error: { code: "not_found", message: "Client not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: client });
  } catch (err) {
    console.error(`GET /api/clients/${id} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load client." } }, { status: 500 });
  }
}

type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_clients");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "A JSON body is required." } }, { status: 400 });
  }

  const patch: ClientUpdate = {};
  if ("company" in body) {
    // `company` is NOT NULL — reject a blank here rather than letting the
    // constraint surface as an opaque 500.
    const company = typeof body.company === "string" ? body.company.trim() : "";
    if (!company) {
      return NextResponse.json({ error: { code: "bad_request", message: "Company cannot be empty." } }, { status: 400 });
    }
    patch.company = company;
  }
  if ("contactName" in body) assignNullableText(patch, "contact_name", body.contactName);
  if ("email" in body) assignNullableText(patch, "email", body.email);
  if ("phone" in body) assignNullableText(patch, "phone", body.phone);
  if ("industry" in body) assignNullableText(patch, "industry", body.industry);
  if ("accountManagerId" in body) assignNullableText(patch, "account_manager_id", body.accountManagerId);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "No editable fields supplied." } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select("id").maybeSingle();

  if (error) {
    const badReference = error.code === "23503";
    console.error(`PATCH /api/clients/${id} failed`, error);
    return NextResponse.json(
      {
        error: {
          code: badReference ? "bad_request" : "server_error",
          message: badReference ? "Unknown account manager." : "Failed to update client.",
        },
      },
      { status: badReference ? 400 : 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: { code: "not_found", message: "Client not found." } }, { status: 404 });
  }

  return NextResponse.json({ data: await getClientDetail(supabase, id) });
}
