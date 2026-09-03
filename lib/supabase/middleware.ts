import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT locally (via the cached JWKS) instead of doing a
  // network round-trip to Supabase Auth on every single navigation, which was adding
  // ~200-500ms to every page load. This is only the cheap routing gate: the
  // authoritative check still runs server-side in app/(app)/layout.tsx via
  // getCurrentUserProfile() -> getUser(), and every table read is behind RLS. A forged
  // cookie gets past this redirect but still cannot read or write anything.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ? { id: claims.claims.sub } : null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic && path !== "/") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", path);
    return NextResponse.redirect(loginUrl);
  }

  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
