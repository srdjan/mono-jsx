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
  if (isString(style)) return style;
  if (!isObject(style)) return "";
  let css = "";
  for (const [k, v] of Array.isArray(style) ? style : Object.entries(style)) {
    if (v === null || v === undefined || v === false || Number.isNaN(v) || !isString(k)) return "";
    const cssKey = toHyphenCase(k);
    const cssValue = typeof v === "number" ? cssBareUnitProps.has(cssKey) ? "" + v : v + "px" : "" + v;
    css += (css !== "" ? ";" : "") + cssKey + ":" + (cssKey === "content" ? JSON.stringify(cssValue) : cssValue);
  }
  return css;
}
