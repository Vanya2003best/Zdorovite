import { Service, ServiceLayout } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  services: Service[];
  layout: ServiceLayout;
  styles: TemplateStyles;
  accentColor: string;
}

function CardsLayout({ services, styles: s, accentColor }: Omit<Props, "layout">) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {services.map((service) => (
        <div
          key={service.name}
          className={`${s.rounded} ${s.cardBg} ${s.cardBorder} ${s.cardShadow} p-5`}
        >
          <div className="flex items-start justify-between">
            <h3 className={`font-semibold ${s.headingColor}`}>
              {service.name}
            </h3>
            <span className="text-lg font-bold" style={{ color: accentColor }}>
              {service.price} zł
            </span>
          </div>
          <p className={`mt-2 text-sm ${s.textColor}`}>
            {service.description}
          </p>
          {service.duration > 0 && (
            <p className={`mt-2 text-xs ${s.mutedColor}`}>
              {service.duration} min
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ListLayout({ services, styles: s, accentColor }: Omit<Props, "layout">) {
  return (
    <div className="space-y-3">
      {services.map((service) => (
        <div
          key={service.name}
          className={`flex items-center justify-between ${s.rounded} ${s.cardBg} ${s.cardBorder} px-5 py-4`}
        >
          <div>
            <h3 className={`font-semibold ${s.headingColor}`}>
              {service.name}
            </h3>
            <p className={`text-sm ${s.textColor}`}>{service.description}</p>
          </div>
          <div className="shrink-0 text-right ml-4">
            <span className="text-lg font-bold" style={{ color: accentColor }}>
              {service.price} zł
            </span>
            {service.duration > 0 && (
              <p className={`text-xs ${s.mutedColor}`}>{service.duration} min</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableLayout({ services, styles: s, accentColor }: Omit<Props, "layout">) {
  return (
    <div className={`overflow-hidden ${s.rounded} ${s.cardBorder}`}>
      <table className="w-full">
        <thead>
          <tr className={`${s.cardBg} border-b ${s.divider}`}>
            <th className={`px-4 py-3 text-left text-sm font-semibold ${s.headingColor}`}>
              Usługa
            </th>
            <th className={`px-4 py-3 text-left text-sm font-semibold ${s.headingColor} hidden sm:table-cell`}>
              Czas
            </th>
            <th className={`px-4 py-3 text-right text-sm font-semibold ${s.headingColor}`}>
              Cena
            </th>
          </tr>
        </thead>
        <tbody>
          {services.map((service, i) => (
            <tr
              key={service.name}
              className={`${s.cardBg} ${i < services.length - 1 ? `border-b ${s.divider}` : ""}`}
            >
              <td className="px-4 py-3">
                <p className={`font-medium ${s.headingColor}`}>{service.name}</p>
                <p className={`text-sm ${s.mutedColor}`}>{service.description}</p>
              </td>
              <td className={`px-4 py-3 text-sm ${s.textColor} hidden sm:table-cell`}>
                {service.duration > 0 ? `${service.duration} min` : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-bold" style={{ color: accentColor }}>
                  {service.price} zł
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ServicesSection({ services, layout, styles, accentColor }: Props) {
  return (
    <section>
      <h2 className={`text-xl font-bold ${styles.headingColor}`}>
        Usługi i cennik
      </h2>
      <div className="mt-4">
        {layout === "list" && (
          <ListLayout services={services} styles={styles} accentColor={accentColor} />
        )}
        {layout === "table" && (
          <TableLayout services={services} styles={styles} accentColor={accentColor} />
        )}
        {layout === "cards" && (
          <CardsLayout services={services} styles={styles} accentColor={accentColor} />
        )}
      </div>
    </section>
  );
}
