import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getClientRows } from "@/lib/clients";
import { readPagination } from "@/lib/format";

// GET /api/clients — manager+ (claude.md > API Structure). Client relationships
// aren't a recruiter-facing surface.
export async function GET(request: Request) {
  const guard = await requirePermission("manage_clients");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  try {
    const { rows, total } = await getClientRows(supabase, {
      search: searchParams.get("search") ?? undefined,
      pagination: readPagination(searchParams),
    });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error("GET /api/clients failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load clients." } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission("manage_clients");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  if (!company) {
    return NextResponse.json({ error: { code: "bad_request", message: "Company is required." } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      company,
      contact_name: typeof body?.contactName === "string" && body.contactName.trim() ? body.contactName.trim() : null,
      email: typeof body?.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null,
      phone: typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
      industry: typeof body?.industry === "string" && body.industry.trim() ? body.industry.trim() : null,
      account_manager_id:
        typeof body?.accountManagerId === "string" && body.accountManagerId ? body.accountManagerId : null,
    })
    .select("id, company, contact_name, email, phone, industry, account_manager_id, created_at")
    .single();

  if (error) {
    const badReference = error.code === "23503";
    console.error("POST /api/clients failed", error);
    return NextResponse.json(
      {
        error: {
          code: badReference ? "bad_request" : "server_error",
          message: badReference ? "Unknown account manager." : "Failed to create client.",
        },
      },
      { status: badReference ? 400 : 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
