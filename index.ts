const iconsRegistry = new Map<string, string>();

export function defineIcon(name: string, svg: string): void {
  const svgTagStart = svg.indexOf("<svg");
  const svgTagEnd = svg.indexOf(">", svgTagStart);
  const viewBox = svg.slice(0, svgTagEnd).match(/viewBox=['"]([^'"]+)['"]/)?.[1] ?? "";
  const iconSvg = '<svg class="icon" role="img" aria-hidden="true" style="width:auto;height:1em" fill="none"'
    + " viewBox=" + JSON.stringify(viewBox)
    + ' xmlns="http://www.w3.org/2000/svg">'
    + svg.slice(svgTagEnd + 1).replace(/\n/g, "").replace(/=['"](black|#000000)['"]/g, '="currentColor"');
  iconsRegistry.set(name.replace(/^icon-/, ""), iconSvg);
}

Reflect.set(globalThis, "JSX", { iconsRegistry });
