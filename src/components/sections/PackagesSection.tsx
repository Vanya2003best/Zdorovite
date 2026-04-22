import { Package } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  packages: Package[];
  styles: TemplateStyles;
  accentColor: string;
}

export default function PackagesSection({ packages, styles: s, accentColor }: Props) {
  if (packages.length === 0) return null;

  return (
    <section>
      <h2 className={`text-xl font-bold ${s.headingColor}`}>Pakiety</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative flex flex-col ${s.rounded} ${s.cardBg} ${s.cardShadow} p-6 ${
              pkg.featured
                ? "ring-2"
                : s.cardBorder
            }`}
            style={pkg.featured ? { boxShadow: `0 0 0 2px ${accentColor}` } : undefined}
          >
            {pkg.featured && (
              <span
                className="absolute -top-3 left-4 rounded-full px-3 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                Popularne
              </span>
            )}
            <h3 className={`text-lg font-bold ${s.headingColor}`}>
              {pkg.name}
            </h3>
            <p className={`mt-1 text-sm ${s.textColor}`}>{pkg.description}</p>

            <div className="mt-4">
              <span className="text-3xl font-bold" style={{ color: accentColor }}>
                {pkg.price} zł
              </span>
              {pkg.period && (
                <span className={`text-sm ${s.mutedColor}`}>
                  {" "}
                  / {pkg.period}
                </span>
              )}
            </div>

            <ul className="mt-4 flex-1 space-y-2">
              {pkg.items.map((item) => (
                <li
                  key={item}
                  className={`flex items-start gap-2 text-sm ${s.textColor}`}
                >
                  <span className="mt-0.5" style={{ color: accentColor }}>
                    &#10003;
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <button
              className={`mt-6 w-full ${s.rounded} px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90`}
              style={{ backgroundColor: accentColor }}
            >
              Wybierz pakiet
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
