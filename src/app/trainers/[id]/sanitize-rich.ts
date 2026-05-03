/**
 * Strict HTML allowlist for rich copy fields (e.g. fullbleed quote, decorated H2s).
 *
 * Trainer-edited fields can contain inline formatting we want to render via
 * dangerouslySetInnerHTML. To stay safe we keep a minimal allowlist:
 *  - <em> ... </em>           (italic)
 *  - <strong> ... </strong>   (rare, but cheap to allow)
 *  - <br>                     (line break)
 *  - <span style="color: #RRGGBB"> ... </span>   (single inline color, hex-only)
 *
 * Anything else — script, iframe, on* attributes, data URIs, javascript: URLs,
 * style values that aren't a hex color, other tags — is stripped down to its
 * text content. Output is safe to feed into dangerouslySetInnerHTML.
 *
 * Implementation note: we use string-level parsing rather than a DOM library
 * because this runs in a server action (no DOMParser) and pulling jsdom in
 * just for this is overkill. The grammar we accept is tiny and regex-tractable.
 */

// Whitelist of tag names (lowercase, void or paired)
const PAIRED_TAGS = new Set(["em", "strong", "span"]);
const VOID_TAGS = new Set(["br"]);

// Strict hex color: #RGB or #RRGGBB. No other CSS values (var()/url()/etc).
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// Browsers normalize `style.color = "#ff5722"` to `rgb(255, 87, 34)` when
// serialising innerHTML, so the round-trip span comes back in rgb form even
// though we set hex. Accept rgb(r, g, b) and convert back to hex so storage
// stays consistent (and so future hex-only validators don't trip).
const RGB_COLOR_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n | 0));
  const h = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function normaliseColor(raw: string): string | null {
  const v = raw.trim();
  if (HEX_COLOR_RE.test(v)) return v;
  const m = RGB_COLOR_RE.exec(v);
  if (m) return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

/**
 * Returns the input string with anything outside the allowlist removed (kept
 * as text where possible). Idempotent: sanitizing a sanitized string is a
 * no-op modulo whitespace.
 */
export function sanitizeRichHTML(input: string): string {
  if (!input) return "";

  // Tokenize: split on tag-looking patterns. Anything that doesn't match an
  // allowed pattern gets HTML-escaped or dropped.
  const TAG_RE = /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;

  let out = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(input)) !== null) {
    const [whole, tagNameRaw, attrs] = match;
    const tagName = tagNameRaw.toLowerCase();
    const isClosing = whole.startsWith("</");

    // Pass through (unescaped) any text before this tag
    out += input.slice(lastIndex, match.index);
    lastIndex = match.index + whole.length;

    if (PAIRED_TAGS.has(tagName)) {
      if (isClosing) {
        out += `</${tagName}>`;
      } else if (tagName === "span") {
        // Allow only `style="color: <hex|rgb()>"`. Anything else collapses to
        // a bare <span> (visually inert, kept for structure).
        const styleMatch = /style\s*=\s*"([^"]*)"/i.exec(attrs);
        if (!styleMatch) {
          out += "<span>";
          continue;
        }
        const colorMatch = /color\s*:\s*([^;]+)/i.exec(styleMatch[1]);
        if (!colorMatch) {
          out += "<span>";
          continue;
        }
        const normalized = normaliseColor(colorMatch[1]);
        if (normalized) {
          out += `<span style="color: ${normalized}">`;
        } else {
          out += "<span>";
        }
      } else {
        // <em> / <strong> — no attributes preserved
        out += `<${tagName}>`;
      }
    } else if (VOID_TAGS.has(tagName)) {
      if (!isClosing) out += `<${tagName}>`;
      // ignore </br> — invalid HTML
    }
    // Else: tag not in allowlist → drop (don't append anything for this match)
  }

  // Append trailing text
  out += input.slice(lastIndex);

  return out;
}
