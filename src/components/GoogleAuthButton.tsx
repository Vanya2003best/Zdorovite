import { signInWithGoogle } from "@/app/auth/oauth-actions";

// Renders nothing until the Google provider is actually configured in
// Supabase (NEXT_PUBLIC_AUTH_GOOGLE=1) — no dead buttons.
export default function GoogleAuthButton({ next = "" }: { next?: string }) {
  if (process.env.NEXT_PUBLIC_AUTH_GOOGLE !== "1") return null;

  return (
    <div className="grid gap-4">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="w-full h-11 rounded-[10px] border border-slate-200 bg-white text-sm font-semibold text-slate-700 inline-flex items-center justify-center gap-2.5 hover:bg-slate-50 transition"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 001 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1 11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
          Kontynuuj z Google
        </button>
      </form>
      <div className="flex items-center gap-3 text-[11px] text-slate-400 uppercase tracking-wider">
        <span className="flex-1 h-px bg-slate-200" />
        lub
        <span className="flex-1 h-px bg-slate-200" />
      </div>
    </div>
  );
}
