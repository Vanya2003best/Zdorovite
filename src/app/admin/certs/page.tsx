import { createAdminSupabase, getAdminUser } from "@/lib/admin";
import { redirect } from "next/navigation";
import CertReviewRow from "./CertReviewRow";

/**
 * Admin queue: every certification awaiting review (status='pending')
 * surfaces here, plus filters for the other statuses so the admin can
 * audit past decisions or revisit a rejected row. Service-role client
 * so we can read across all trainers without RLS.
 */
export default async function AdminCertsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const params = (await searchParams) ?? {};
  const allowed = ["pending", "verified", "rejected", "unverified", "all"] as const;
  type Filter = (typeof allowed)[number];
  const filter: Filter = (allowed as readonly string[]).includes(params.status ?? "")
    ? (params.status as Filter)
    : "pending";

  const supabase = createAdminSupabase();

  // Pull rows + the trainer's display_name + slug for context. The
  // Supabase JS client supports inline joins via the FK string.
  let query = supabase
    .from("certifications")
    .select(
      `
      id, text, verification_url, attachment_url, attachment_filename,
      verification_status, reject_reason, reviewed_at, reviewed_by, created_at,
      trainer:trainers!trainer_id (
        slug,
        profile:profiles!id ( display_name, avatar_url )
      )
      `,
    )
    .order("created_at", { ascending: true });
  if (filter !== "all") query = query.eq("verification_status", filter);

  const { data: rows, error } = await query;
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700">
        Błąd ładowania: {error.message}
      </div>
    );
  }

  // Counts for the filter pills.
  const { data: countRows } = await supabase
    .from("certifications")
    .select("verification_status");
  const counts = { unverified: 0, pending: 0, verified: 0, rejected: 0 };
  for (const r of countRows ?? []) {
    const s = (r as { verification_status?: keyof typeof counts }).verification_status;
    if (s && s in counts) counts[s] += 1;
  }

  type RowShape = {
    id: string;
    text: string;
    verification_url: string | null;
    attachment_url: string | null;
    attachment_filename: string | null;
    verification_status: "unverified" | "pending" | "verified" | "rejected";
    reject_reason: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    created_at: string;
    trainer: {
      slug: string;
      profile: { display_name: string | null; avatar_url: string | null } | null;
    } | null;
  };

  const list = (rows ?? []) as unknown as RowShape[];

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-5">
        <h1 className="text-[24px] font-semibold tracking-tight m-0">Weryfikacja certyfikatów</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Sprawdź dowody (URL rejestru lub PDF) i zatwierdź lub odrzuć z powodem. Trener zobaczy decyzję
          natychmiast w swoim panelu.
        </p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <FilterPill href="/admin/certs?status=pending" active={filter === "pending"} count={counts.pending}>
          Oczekuje
        </FilterPill>
        <FilterPill href="/admin/certs?status=verified" active={filter === "verified"} count={counts.verified}>
          Zatwierdzone
        </FilterPill>
        <FilterPill href="/admin/certs?status=rejected" active={filter === "rejected"} count={counts.rejected}>
          Odrzucone
        </FilterPill>
        <FilterPill href="/admin/certs?status=unverified" active={filter === "unverified"} count={counts.unverified}>
          Bez dowodów
        </FilterPill>
        <FilterPill href="/admin/certs?status=all" active={filter === "all"}>
          Wszystkie
        </FilterPill>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center text-slate-500">
          Brak rekordów w tej zakładce.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <CertReviewRow
              key={r.id}
              cert={{
                id: r.id,
                text: r.text,
                verificationUrl: r.verification_url,
                attachmentUrl: r.attachment_url,
                attachmentFilename: r.attachment_filename,
                status: r.verification_status,
                rejectReason: r.reject_reason,
                createdAt: r.created_at,
                trainerName: r.trainer?.profile?.display_name ?? "Bez nazwy",
                trainerSlug: r.trainer?.slug ?? "",
                trainerAvatar: r.trainer?.profile?.avatar_url ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition " +
        (active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300")
      }
    >
      {children}
      {typeof count === "number" && (
        <span
          className={
            "text-[11px] tabular-nums " + (active ? "text-slate-300" : "text-slate-500")
          }
        >
          {count}
        </span>
      )}
    </a>
  );
}
