import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Email and password are required." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase reports bad credentials / unconfirmed email as 400s — those map
    // to the login form's own error slot. Anything else (5xx from GoTrue/the
    // DB) is a real server-side failure and must not be disguised as a wrong
    // password, or an outage looks identical to a user mistyping their password.
    if (error.status && error.status >= 500) {
      return NextResponse.json(
        { error: { code: "auth_unavailable", message: "Sign-in is temporarily unavailable. Please try again." } },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: { code: "invalid_credentials", message: "Incorrect email or password." } },
      { status: 401 }
    );
  }

  return NextResponse.json({ data: { userId: data.user.id } });
}
