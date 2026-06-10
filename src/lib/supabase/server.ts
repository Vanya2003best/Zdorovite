import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session-scoped marker set by the login action when "Pamiętaj mnie" is
// unchecked: while it is present, auth cookies are written WITHOUT
// maxAge/expires, so the login lives only until the browser closes.
export const SESSION_ONLY_COOKIE = "nz-session-only";

export async function createClient() {
  const cookieStore = await cookies();
  const sessionOnly = cookieStore.has(SESSION_ONLY_COOKIE);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                sessionOnly
                  ? { ...options, maxAge: undefined, expires: undefined }
                  : options
              )
            );
          } catch {
            // called from a Server Component — ignore; middleware refreshes session
          }
        },
      },
    }
  );
}
