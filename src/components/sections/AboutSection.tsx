import { TemplateStyles } from "@/data/templates";

interface Props {
  about: string;
  styles: TemplateStyles;
}

export default function AboutSection({ about, styles: s }: Props) {
  return (
    <section id="about" data-section-id="about" className={`${s.sectionPadding} ${s.sectionBorder} scroll-mt-20`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Moja filozofia" : "O mnie"}
      </div>
      <p className={s.bodyText}>{about}</p>
    </section>
  );
}
