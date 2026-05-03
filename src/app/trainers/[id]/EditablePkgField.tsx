"use client";

import { useRouter } from "next/navigation";
import { updatePackageField } from "./package-actions";
import InlineEditable from "./InlineEditable";

type Field = "name" | "description" | "price" | "period";
type Theme = "light" | "dark";

const FIELD_CONFIG: Record<
  Field,
  { maxLength: number; numeric?: boolean; multiline?: boolean; block?: boolean }
> = {
  name:        { maxLength: 30 },
  description: { maxLength: 80, multiline: true, block: true },
  price:       { maxLength: 6, numeric: true },
  period:      { maxLength: 20 },
};

export default function EditablePkgField({
  packageId,
  field,
  initial,
  placeholder,
  className = "",
  theme = "light",
}: {
  packageId: string;
  field: Field;
  initial: string;
  placeholder?: string;
  className?: string;
  theme?: Theme;
}) {
  const router = useRouter();
  const cfg = FIELD_CONFIG[field];

  const onCommit = async (next: string) => {
    const res = await updatePackageField(packageId, field, next);
    if ("error" in res) {
      router.refresh();
      return;
    }
    router.refresh();
  };

  return (
    <InlineEditable
      initial={initial}
      maxLength={cfg.maxLength}
      numeric={cfg.numeric}
      multiline={cfg.multiline}
      block={cfg.block}
      placeholder={placeholder}
      theme={theme}
      className={className}
      onCommit={onCommit}
    />
  );
}
