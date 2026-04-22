import { TemplateStyles } from "@/data/templates";

interface Props {
  certifications: string[];
  styles: TemplateStyles;
  accentColor: string;
}

export default function CertificationsSection({
  certifications,
  styles: s,
  accentColor,
}: Props) {
  if (certifications.length === 0) return null;

  return (
    <section>
      <h2 className={`text-xl font-bold ${s.headingColor}`}>Certyfikaty</h2>
      <ul className="mt-3 space-y-2">
        {certifications.map((cert) => (
          <li
            key={cert}
            className={`flex items-start gap-2 ${s.textColor}`}
          >
            <span className="mt-0.5" style={{ color: accentColor }}>
              &#10003;
            </span>
            {cert}
          </li>
        ))}
      </ul>
    </section>
  );
}
