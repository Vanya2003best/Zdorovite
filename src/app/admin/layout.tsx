import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";

/**
 * Admin shell — gates everything under /admin behind the email
 * allowlist (ADMIN_EMAILS env var). Non-admins get bounced to the
 * homepage; logged-out users to /login. Layout is intentionally
 * minimal — separate nav, no marketing chrome.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-14 bg-slate-900 text-white flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight">NaZdrow! · Admin</span>
          <nav className="flex gap-4 text-[13px]">
            <Link href="/admin/certs" className="hover:text-emerald-300">
              Weryfikacja certyfikatów
            </Link>
          </nav>
        </div>
        <div className="text-[12px] text-slate-300">{admin.email}</div>
      </header>
      <main className="px-4 sm:px-8 py-6">{children}</main>
    </div>
  );
}
