import Link from "next/link";
import { Package } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  packages: Package[];
  styles: TemplateStyles;
  trainerSlug?: string;
}

export default function PackagesSection({ packages, styles: s, trainerSlug }: Props) {
  if (packages.length === 0) return null;

  return (
    <section id="packages" data-section-id="packages" className={`${s.sectionPadding} ${s.sectionBorder} scroll-mt-20`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Pakiety z sercem" : "Pakiety"}
      </div>
      <div className={s.pkgContainerStyle}>
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            data-placeholder={pkg.isPlaceholder ? "true" : undefined}
            title={pkg.isPlaceholder ? "Kliknij aby spersonalizować — to przykładowe dane" : undefined}
            className={`${pkg.featured ? s.pkgFeaturedStyle : s.pkgCardStyle} ${pkg.isPlaceholder ? "opacity-60 hover:opacity-100 transition" : ""}`}
          >
            {pkg.featured && (
              <span className={s.pkgFeaturedBadge}>
                {s.name === "cozy" ? "✨ Ulubione" : "Popularne"}
              </span>
            )}
            <div className={s.pkgNameStyle}>{pkg.name}</div>
            <div className={s.pkgPriceStyle}>
              {pkg.price.toLocaleString("pl-PL")} zł
            </div>
            <ul className="list-none p-0 m-0 grid gap-0.5 mt-1.5">
              {pkg.items.map((item) => (
                <li key={item} className={s.pkgItemStyle}>
                  {s.name === "cozy" && "🌿 "}
                  {s.name === "premium" && (
                    <span className={s.pkgItemPrefix}>&#10003; </span>
                  )}
                  {item}
                </li>
              ))}
            </ul>
            {s.pkgButtonStyle !== "hidden" && (
              trainerSlug ? (
                <Link
                  href={`/trainers/${trainerSlug}/checkout/${pkg.id}`}
                  className={`${s.pkgButtonStyle} inline-flex items-center justify-center text-center no-underline`}
                >
                  Wybierz {pkg.name}
                </Link>
              ) : (
                <button className={s.pkgButtonStyle}>Wybierz {pkg.name}</button>
              )
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
