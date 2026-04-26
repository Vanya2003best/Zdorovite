import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

function LoginFormFallback() {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="grid gap-1.5">
        <div className="h-4 w-12 bg-slate-100 rounded" />
        <div className="h-11 rounded-lg bg-slate-100" />
      </div>
      <div className="grid gap-1.5">
        <div className="h-4 w-12 bg-slate-100 rounded" />
        <div className="h-11 rounded-lg bg-slate-100" />
      </div>
      <div className="h-12 mt-2 rounded-xl bg-slate-100" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-5 sm:px-6 py-16 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Zaloguj się</h1>
      <p className="text-sm text-slate-600 mt-2 mb-8">
        Nie masz konta?{" "}
        <Link href="/register" className="text-emerald-700 font-medium hover:underline">
          Zarejestruj się jako klient
        </Link>{" "}
        ·{" "}
        <Link href="/register/trainer" className="text-emerald-700 font-medium hover:underline">
          Zostań trenerem
        </Link>
      </p>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
