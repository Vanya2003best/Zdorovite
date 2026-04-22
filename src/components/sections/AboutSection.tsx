import { TemplateStyles } from "@/data/templates";

interface Props {
  about: string;
  styles: TemplateStyles;
}

export default function AboutSection({ about, styles: s }: Props) {
  return (
    <section className={`${s.sectionPadding} ${s.sectionBorder}`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Moja filozofia" : s.name === "sport" ? "Misja" : "O mnie"}
      </div>
      <p className={s.bodyText}>{about}</p>
    </section>
  );
}
