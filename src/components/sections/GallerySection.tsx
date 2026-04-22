import { TemplateStyles } from "@/data/templates";

interface Props {
  gallery: string[];
  styles: TemplateStyles;
}

export default function GallerySection({ gallery, styles: s }: Props) {
  if (gallery.length === 0) return null;

  return (
    <section className={`${s.sectionPadding} ${s.sectionBorder}`}>
      <div className={s.sectionTitleStyle}>Galeria</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {gallery.map((src, i) => (
          <div
            key={i}
            className="aspect-square overflow-hidden rounded-xl bg-gray-100"
          >
            <img
              src={src}
              alt={`Zdjęcie ${i + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
