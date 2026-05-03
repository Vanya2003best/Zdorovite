import type { ItemOverride, Service, Package, ProfileCustomization } from "@/types";

/**
 * Pure helpers that fold per-page overrides into the master service/package
 * lists at render time. Used by every template's services/packages section so
 * a hidden item disappears, a renamed item shows the override label, and a
 * reordered list reflects the page's chosen sequence.
 *
 * No I/O — these run synchronously during render with whatever lists were
 * fetched from DB and whatever customization is in scope.
 */

function applyOverride<T extends { id?: string; name: string; description: string; price: number }>(
  item: T,
  override: ItemOverride | undefined,
): T {
  if (!override) return item;
  return {
    ...item,
    name: override.name?.trim() || item.name,
    description: override.description?.trim() || item.description,
    price: typeof override.price === "number" ? override.price : item.price,
  };
}

function sortWithOverrides<T extends { id?: string }>(
  items: T[],
  overrides: Record<string, ItemOverride>,
): T[] {
  // Stable sort that prefers override.position when set, falls back to original
  // index so items without explicit position stay in their pre-override order.
  return items
    .map((it, idx) => {
      const ov = it.id ? overrides[it.id] : undefined;
      return {
        item: it,
        ord: typeof ov?.position === "number" ? ov.position : idx + 10000,
      };
    })
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.item);
}

export function applyServiceOverrides(
  services: Service[],
  customization: ProfileCustomization,
): Service[] {
  const overrides = customization.serviceOverrides ?? {};
  const visible = services.filter((s) => {
    const ov = s.id ? overrides[s.id] : undefined;
    return !ov?.hidden;
  });
  const ordered = sortWithOverrides(visible, overrides);
  return ordered.map((s) => applyOverride(s, s.id ? overrides[s.id] : undefined));
}

export function applyPackageOverrides(
  packages: Package[],
  customization: ProfileCustomization,
): Package[] {
  const overrides = customization.packageOverrides ?? {};
  const visible = packages.filter((p) => !overrides[p.id]?.hidden);
  const ordered = sortWithOverrides(visible, overrides);
  return ordered.map((p) => applyOverride(p, overrides[p.id]));
}
