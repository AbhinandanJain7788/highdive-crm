import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientKeyFor } from "@/lib/rateLimit";

// Rate limited per (IP + email) at 5 attempts / 60s — Phase 7 Step 4's login-throttle
// checkpoint. Keyed on the pair rather than IP alone so one shared office IP can't
// lock every user out from a single attacker targeting one account, and rather than
// email alone so an attacker can't fan a flood out across many guessed emails from
// one IP to dodge the limit.
export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Email and password are required." } },
      { status: 400 }
    );
  }

  const rateLimitKey = `${clientKeyFor(request)}:${String(email).toLowerCase()}`;
  const rate = checkRateLimit(rateLimitKey, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many login attempts. Please try again shortly." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
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

  // Best-effort: backs Analytics' Login Duration widget (Phase 6). Never blocks sign-in
  // on a logging failure — the row simply won't exist and that session's duration is
  // undercounted, which is far better than a working login failing on an insert error.
  try {
    await supabase.from("activity_logs").insert({
      actor_id: data.user.id,
      action: "login",
      entity_type: "user",
      entity_id: data.user.id,
    });
  } catch (err) {
    console.error("Failed to log login activity", err);
  }

  return NextResponse.json({ data: { userId: data.user.id } });
}
