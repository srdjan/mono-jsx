import type { FC, VNode } from "./types/jsx.d.ts";
import { $fragment, $vnode, iconsRegistry } from "./jsx.ts";
import { render } from "./render.ts";

const jsx = (tag: string | FC, props: Record<string, unknown>, key?: string | number): VNode => {
  const vnode = new Array(3).fill(null);
  vnode[0] = tag;
  vnode[1] = props;
  vnode[2] = $vnode;
  if (key !== undefined) {
    props.key = key;
  }
  if (tag === "html") {
    const renderOptions = Object.create(null);
    for (const key of ["request", "headers", "rendering"]) {
      if (Object.hasOwn(props, key)) {
        renderOptions[key] = props[key];
        delete props[key];
      }
    }
    const res = render(vnode as unknown as VNode, renderOptions);
    (res as unknown as Array<unknown>).length = 3;
    (res as unknown as Array<unknown>)[Symbol.iterator] = function*() {
      for (let i = 0; i < 3; i++) {
        yield vnode[i];
      }
    };
    return res as unknown as VNode;
  }
  return vnode as unknown as VNode;
};

function jsxIcon(name: string, svg: string): void {
  const svgTagStart = svg.indexOf("<svg");
  const svgTagEnd = svg.indexOf(">", svgTagStart);
  const viewBox = svg.slice(0, svgTagEnd).match(/viewBox=['"]([^'"]+)['"]/)?.[1] ?? "";
  const iconSvg = '<svg class="icon" role="img" aria-hidden="true" style="width:auto;height:1em" fill="none"'
    + " viewBox=" + JSON.stringify(viewBox)
    + ' xmlns="http://www.w3.org/2000/svg">'
    + svg.slice(svgTagEnd + 1).replace(/\n/g, "").replace(/=['"](black|#000000)['"]/g, '="currentColor"');
  iconsRegistry.set(name.replace(/^icon-/, ""), iconSvg);
}

export { $fragment as Fragment, jsx, jsx as jsxs, jsxIcon };
