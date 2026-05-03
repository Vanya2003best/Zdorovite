import { TemplateStyles } from "@/data/templates";

interface Props {
  certifications: string[];
  styles: TemplateStyles;
}

export default function CertificationsSection({ certifications, styles: s }: Props) {
  if (certifications.length === 0) return null;

  return (
    <section id="certifications" data-section-id="certifications" className={`${s.sectionPadding} ${s.sectionBorder} scroll-mt-20`}>
      <div className={s.sectionTitleStyle}>Certyfikaty</div>
      <ul className="space-y-2 list-none p-0 m-0">
        {certifications.map((cert) => (
          <li key={cert} className={`flex items-start gap-2 ${s.certTextStyle}`}>
            <span className={`mt-0.5 ${s.certCheckColor}`}>&#10003;</span>
            {cert}
          </li>
        ))}
      </ul>
    </section>
  );
}
