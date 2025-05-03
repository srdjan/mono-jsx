const cssBareUnitProps = new Set([
  "animation-iteration-count",
  "aspect-ratio",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex-group",
  "box-flex",
  "box-ordinal-group",
  "column-count",
  "columns",
  "fill-opacity",
  "flex-grow",
  "flex-negative",
  "flex-order",
  "flex-positive",
  "flex-shrink",
  "flex",
  "flood-opacity",
  "font-weight",
  "grid-area",
  "grid-column-end",
  "grid-column-span",
  "grid-column-start",
  "grid-column",
  "grid-row-end",
  "grid-row-span",
  "grid-row-start",
  "grid-row",
  "line-clamp",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
]);

export const isString = (v: unknown): v is string => typeof v === "string";
export const isObject = (v: unknown): v is object => typeof v === "object" && v !== null;
export const toHyphenCase = (k: string) => k.replace(/[a-z][A-Z]/g, (m) => m.charAt(0) + "-" + m.charAt(1).toLowerCase());

/** merge class names. */
export function cx(className: unknown): string {
  if (isString(className)) {
    return className;
  }
  if (isObject(className)) {
    if (Array.isArray(className)) {
      return className.map(cx).filter(Boolean).join(" ");
    }
    return Object.entries(className).filter(([, v]) => !!v).map(([k]) => k).join(" ");
  }
  return "";
}

/** converts style object to css string. */
export function styleToCSS(style: unknown): string {
  if (isString(style)) {
    return style;
  }
  if (isObject(style)) {
    let css = "";
    for (const [k, v] of Array.isArray(style) ? style : Object.entries(style)) {
      if (isString(k) && (isString(v) || typeof v === "number")) {
        const cssKey = toHyphenCase(k);
        const cssValue = typeof v === "number" ? (cssBareUnitProps.has(cssKey) ? "" + v : v + "px") : escapeCSSText("" + v);
        css += (css ? ";" : "") + escapeCSSText(cssKey) + ":" + (cssKey === "content" ? JSON.stringify(cssValue) : cssValue);
      }
    }
    return css;
  }
  return "";
}

/** escapes special characters in a given css string. */
export function escapeCSSText(str: string): string {
  return str.replace(/["<>]/g, (m) => {
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return "'";
  });
}

/**
 * Escapes special characters and HTML entities in a given html string.
 * Based on https://github.com/component/escape-html
 * Use `Bun.escapeHTML` preferentially if available.
 *
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT License
 */
const regexpHtmlSafe = /["'&<>]/;
export function escapeHTML(str: string): string {
  // @ts-ignore use bun's built-in `escapeHTML` function if available
  if (typeof Bun === "object" && "escapeHTML" in Bun) return Bun.escapeHTML(str);

  const match = regexpHtmlSafe.exec(str);
  if (!match) {
    return str;
  }

  let escape: string;
  let index: number;
  let lastIndex = 0;
  let html = "";

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = "&quot;";
        break;
      case 38: // &
        escape = "&amp;";
        break;
      case 39: // '
        escape = "&#x27;"; // modified from escape-html; used to be '&#39'
        break;
      case 60: // <
        escape = "&lt;";
        break;
      case 62: // >
        escape = "&gt;";
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.slice(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + str.slice(lastIndex, index) : html;
}
