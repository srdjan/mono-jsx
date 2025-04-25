import type { FC, VNode } from "./types/jsx.d.ts";
import { $context, $fragment, $html, $iconsRegistry, $vnode } from "./symbols.ts";
import { computed, state } from "./state.ts";
import { render } from "./render.ts";

const Fragment = $fragment as unknown as FC;

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
    for (const key of ["request", "data", "status", "headers", "rendering"]) {
      if (Object.hasOwn(props, key)) {
        renderOptions[key] = props[key];
        delete props[key];
      }
    }
    const res = render(vnode as unknown as VNode, renderOptions);
    return res as unknown as VNode;
  }
  return vnode as unknown as VNode;
};

const jsxIcon = (name: string, svg: string) => {
  const svgTagStart = svg.indexOf("<svg");
  const svgTagEnd = svg.indexOf(">", svgTagStart);
  const viewBox = svg.slice(0, svgTagEnd).match(/viewBox=['"]([^'"]+)['"]/)?.[1] ?? "";
  const iconSvg = '<svg class="icon" role="img" aria-hidden="true" style="width:auto;height:1em" fill="none"'
    + " viewBox=" + JSON.stringify(viewBox)
    + ' xmlns="http://www.w3.org/2000/svg">'
    + svg.slice(svgTagEnd + 1).replace(/\n/g, "").replace(/=['"](black|#000000)['"]/g, '="currentColor"');
  $iconsRegistry.set(name.replace(/^icon-/, ""), iconSvg);
};

const context = <T extends Record<string, unknown> = Record<string, unknown>>(): { request: Request; data: T } => {
  if (!Object.hasOwn($context, "request") || !Object.hasOwn($context, "data")) {
    throw new Error("calling `$context` outside of a component");
  }
  return $context as { request: Request; data: T };
};

const html = (raw: string, ...values: unknown[]): VNode => [
  $html,
  { innerHTML: String.raw({ raw }, ...values) },
  $vnode,
];

// global variables
Object.assign(globalThis, {
  $computed: computed,
  $context: context,
  $state: state,
  css: html,
  html,
  js: html,
});

export { Fragment, jsx, jsx as jsxDEV, jsx as jsxs, jsxIcon };
