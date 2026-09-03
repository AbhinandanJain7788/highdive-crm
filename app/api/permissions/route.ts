import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/permissions — flat list of all permissions (id, key, label, category).
// Read is open to any authenticated user (RLS `permissions_select` allows `true`).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in required." } },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("permissions")
    .select("id, key, label, category")
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [] });
}
