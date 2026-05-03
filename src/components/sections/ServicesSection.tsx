import Link from "next/link";
import { Service } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  services: Service[];
  styles: TemplateStyles;
  trainerSlug?: string;
}

export default function ServicesSection({ services, styles: s, trainerSlug }: Props) {
  return (
    <section id="services" data-section-id="services" className={`${s.sectionPadding} ${s.sectionBorder} scroll-mt-20`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Co oferuję" : "Usługi"}
      </div>
      <div className={s.svcContainerStyle}>
        {services.map((service) => {
          const inner = (
            <>
              <div>
                <div className={s.svcNameStyle}>{service.name}</div>
                {s.svcDescStyle !== "hidden" && (
                  <div className={s.svcDescStyle}>
                    {service.duration > 0 ? `${service.duration} min` : ""}
                    {service.duration > 0 && s.name === "cozy" ? " · sala" : ""}
                  </div>
                )}
              </div>
              <div className={s.svcPriceStyle}>
                {service.price} zł
              </div>
            </>
          );
          // Each row links to /trainers/{slug}/book?service={id} so a visitor
          // taps a service and lands on step 1 of booking with that service
          // already selected. Falls back to a non-clickable div if no
          // trainerSlug or service id is available (mock data, editor preview).
          const placeholderClass = service.isPlaceholder ? "opacity-60 hover:opacity-100 transition" : "";
          const placeholderTitle = service.isPlaceholder
            ? "Kliknij aby spersonalizować — to przykładowe dane"
            : undefined;
          if (trainerSlug && service.id) {
            return (
              <Link
                key={service.id}
                href={`/trainers/${trainerSlug}/book?service=${service.id}`}
                title={placeholderTitle}
                data-placeholder={service.isPlaceholder ? "true" : undefined}
                className={`${s.svcItemStyle} no-underline cursor-pointer hover:brightness-[0.98] transition ${placeholderClass}`}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div
              key={service.id ?? service.name}
              title={placeholderTitle}
              data-placeholder={service.isPlaceholder ? "true" : undefined}
              className={`${s.svcItemStyle} ${placeholderClass}`}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
