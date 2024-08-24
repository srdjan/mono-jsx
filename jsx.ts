import type { ChildType, FC, VNode } from "./types/jsx.d.ts";
import { $fragment, $vnode } from "./jsx-fragment.ts";
import { render } from "./render.ts";

const h = (tag: string | FC<any>, props: Record<string, any> | null, ...children: ChildType[]): VNode => {
  const vnode = new Array(4).fill(null) as VNode;
  vnode[0] = tag;
  vnode[3] = $vnode;
  if (props) {
    vnode[1] = props;
  }
  if (children.length > 0) {
    vnode[2] = children;
  }
  if (tag === "html") {
    const renderOptions = Object.create(null);
    if (props) {
      for (const key of ["request", "headers"]) {
        if (Object.hasOwn(props, key)) {
          renderOptions[key] = props[key];
          delete props[key];
        }
      }
    }
    const res = render(vnode, renderOptions);
    (res as any)[Symbol.iterator] = function*() {
      for (let i = 0; i < 4; i++) {
        yield vnode[i];
      }
    };
    return res as unknown as VNode;
  }
  return vnode;
};

const html = (raw: string, ...values: any[]): VNode => [$fragment, { innerHTML: String.raw({ raw }, ...values) }, null, $vnode];
const css = html;
const js = html;
const state = Object.create(null);
Object.assign(globalThis, { html, css, js, state });

export * from "./jsx-fragment.ts";
export * from "./render.ts";
export { css, h, html, js };
