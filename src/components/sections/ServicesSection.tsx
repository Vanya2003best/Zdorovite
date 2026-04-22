import { Service } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  services: Service[];
  styles: TemplateStyles;
}

export default function ServicesSection({ services, styles: s }: Props) {
  return (
    <section className={`${s.sectionPadding} ${s.sectionBorder}`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Co oferuję" : "Usługi"}
      </div>
      <div className={s.svcContainerStyle}>
        {services.map((service) => (
          <div key={service.name} className={s.svcItemStyle}>
            <div>
              <div className={s.svcNameStyle}>{service.name}</div>
              {s.svcDescStyle !== "hidden" && (
                <div className={s.svcDescStyle}>
                  {service.duration > 0 ? `${service.duration} min` : ""}
                  {service.duration > 0 && s.name === "cozy" ? " · sala" : ""}
                  {service.duration > 0 && s.name === "sport" ? " · sala / dom" : ""}
                </div>
              )}
            </div>
            <div className={s.svcPriceStyle}>
              {s.name === "minimal"
                ? `${service.price} zł${service.duration > 0 ? ` · ${service.duration} min` : ""}`
                : `${service.price}${s.name !== "sport" ? " zł" : ""}`}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
