import { GalleryLayout } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  gallery: string[];
  layout: GalleryLayout;
  styles: TemplateStyles;
}

export default function GallerySection({ gallery, styles: s }: Props) {
  if (gallery.length === 0) {
    return (
      <section>
        <h2 className={`text-xl font-bold ${s.headingColor}`}>Galeria</h2>
        <div
          className={`mt-4 flex items-center justify-center ${s.rounded} border-2 border-dashed ${s.divider} py-12`}
        >
          <p className={`text-sm ${s.mutedColor}`}>
            Galeria będzie dostępna wkrótce
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className={`text-xl font-bold ${s.headingColor}`}>Galeria</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {gallery.map((src, i) => (
          <div
            key={i}
            className={`aspect-square overflow-hidden ${s.rounded} ${s.cardBorder} bg-gray-100`}
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
