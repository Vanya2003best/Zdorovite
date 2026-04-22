import { Package } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  packages: Package[];
  styles: TemplateStyles;
}

export default function PackagesSection({ packages, styles: s }: Props) {
  if (packages.length === 0) return null;

  return (
    <section className={`${s.sectionPadding} ${s.sectionBorder}`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Pakiety z sercem" : "Pakiety"}
      </div>
      <div className={s.pkgContainerStyle}>
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={pkg.featured ? s.pkgFeaturedStyle : s.pkgCardStyle}
          >
            {pkg.featured && (
              <span className={s.pkgFeaturedBadge}>
                {s.name === "sport"
                  ? "TOP"
                  : s.name === "cozy"
                    ? "✨ Ulubione"
                    : s.name === "minimal"
                      ? "Popularne"
                      : "Popularne"}
              </span>
            )}
            <div className={s.pkgNameStyle}>{pkg.name}</div>
            <div className={s.pkgPriceStyle}>
              {pkg.price.toLocaleString("pl-PL")}
              {s.name !== "sport" ? " zł" : ""}
            </div>
            <ul className="list-none p-0 m-0 grid gap-0.5 mt-1.5">
              {pkg.items.map((item) => (
                <li key={item} className={s.pkgItemStyle}>
                  {s.name === "sport" && (
                    <span className={s.pkgItemPrefix}>&#9656; </span>
                  )}
                  {s.name === "cozy" && "🌿 "}
                  {s.name === "premium" && (
                    <span className={s.pkgItemPrefix}>&#10003; </span>
                  )}
                  {item}
                </li>
              ))}
            </ul>
            {s.pkgButtonStyle !== "hidden" && (
              <button className={s.pkgButtonStyle}>Wybierz pakiet</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
