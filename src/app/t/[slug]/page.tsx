import { redirect } from "next/navigation";

/**
 * Short-URL redirect — /t/[slug] → /trainers/[slug]?[same query string].
 *
 * Why a separate /t/ route:
 *  - Shorter URL = denser QR code = scans cleaner from across a gym floor.
 *    "/t/anna-kowalska" is 16 chars vs "/trainers/anna-kowalska" at 23.
 *    Multiplied by the source query param (e.g. ?source=zdrofit-aleja-pokoju)
 *    it's a real difference for printed QR.
 *  - Lets us track QR-scan provenance via the `source` param without
 *    polluting the canonical /trainers/[slug] URL that gets shared on
 *    Instagram / WhatsApp / business cards.
 *  - Caller-agnostic: any campaign / partner / printout uses /t/[slug] as
 *    its short-URL, source param tells us who.
 */
export default async function TrainerShortRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  // Preserve every query param (source, utm_*, ref, etc.) on the redirect
  // so /trainers/[slug] sees the same context as the QR delivered.
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else qs.append(k, v);
  }
  const tail = qs.toString();
  redirect(`/trainers/${slug}${tail ? `?${tail}` : ""}`);
}
