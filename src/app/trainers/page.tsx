import { redirect } from "next/navigation";

/**
 * /trainers — historical listing route, now merged into `/`.
 *
 * All internal links that pointed to /trainers (with or without query
 * params) have been updated to `/`. This route remains only as a redirect
 * so external links / bookmarks still work. Preserves the query string
 * verbatim (so /trainers?fav=1 lands on /?fav=1).
 *
 * Individual trainer profile pages (/trainers/[slug]/*) are unaffected —
 * they have their own route segment under [id] and continue to work.
 */

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function TrainersListingRedirect(props: { searchParams: SP }) {
  const sp = await props.searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (Array.isArray(v)) v.forEach((vv) => qs.append(k, vv));
    else if (v != null) qs.set(k, v);
  }
  const tail = qs.toString();
  redirect(tail ? `/?${tail}` : "/");
}
