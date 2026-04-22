import { TemplateStyles } from "@/data/templates";

interface Props {
  about: string;
  styles: TemplateStyles;
}

export default function AboutSection({ about, styles: s }: Props) {
  return (
    <section>
      <h2 className={`text-xl font-bold ${s.headingColor}`}>O mnie</h2>
      <p className={`mt-3 leading-relaxed ${s.textColor}`}>{about}</p>
    </section>
  );
}
