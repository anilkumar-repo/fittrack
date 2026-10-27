import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let authFailed = Boolean(url.searchParams.get("error") || url.searchParams.get("error_code"));
  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && publishableKey) {
      const supabase = createServerClient(supabaseUrl, publishableKey, {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {
              // Cookie writes are not available in every server rendering context.
            }
          },
        },
      });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      authFailed = Boolean(error);
    } else authFailed = true;
  }
  return NextResponse.redirect(new URL(authFailed ? "/?auth=error" : "/", url.origin));
}
