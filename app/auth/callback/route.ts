import { NextResponse, type NextRequest } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = request.nextUrl.searchParams.get("next");
  let next = "/dashboard";
  if (destination) {
    try {
      const candidate = new URL(destination, request.url);
      if (candidate.origin === request.nextUrl.origin) {
        next = `${candidate.pathname}${candidate.search}${candidate.hash}`;
      }
    } catch {
      // Malformed return URLs fall back to the dashboard.
    }
  }

  if (!hasSupabasePublicEnv()) return NextResponse.redirect(new URL("/login", request.url));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}
