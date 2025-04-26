import type { FC, VNode } from "./types/jsx.d.ts";
import { $fragment, $html, $vnode } from "./symbols.ts";
import { render } from "./render.ts";

const jsx = (tag: string | FC, props: Record<string, unknown> = Object.create(null), key?: string | number): VNode => {
  const vnode = new Array(3).fill(null);
  vnode[0] = tag;
  vnode[1] = props;
  vnode[2] = $vnode;
  if (key !== undefined) {
    props.key = key;
  }
  if (tag === "html") {
    const renderOptions = Object.create(null);
    for (const key of ["request", "status", "headers", "rendering"]) {
      if (Object.hasOwn(props, key)) {
        renderOptions[key] = props[key];
        delete props[key];
      }
    }
    return render(vnode as unknown as VNode, renderOptions) as unknown as VNode;
  }
  return vnode as unknown as VNode;
};

const Fragment = $fragment as unknown as FC;

const html = (raw: string, ...values: unknown[]): VNode => [
  $html,
  { innerHTML: String.raw({ raw }, ...values) },
  $vnode,
];

// global variables
Object.assign(globalThis, {
  css: html,
  html,
  js: html,
});

export { Fragment, jsx, jsx as jsxDEV, jsx as jsxs };
