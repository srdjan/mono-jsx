import type { FC, VNode } from "./types/jsx.d.ts";
import { $vnode, Fragment } from "./jsx.ts";
import { render } from "./render.ts";

const jsx = (tag: string | FC<any>, props: Record<string, any>, key?: string | number): VNode => {
  const vnode = new Array(3).fill(null) as VNode;
  vnode[0] = tag;
  vnode[1] = props;
  vnode[2] = $vnode;
  if (key !== undefined) {
    props.key = key;
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
    (res as any).length = 3;
    (res as any)[Symbol.iterator] = function*() {
      for (let i = 0; i < 3; i++) {
        yield vnode[i];
      }
    };
    return res as unknown as VNode;
  }
  return vnode;
};

// deno JSX transform
// async function jsxTemplate(
//   strings: string[],
//   ...values: unknown[]
// ): Promise<string> {
//   return "";
// }
// function jsxAttr(name: string, value: unknown): string {
//   return "";
// }
// async function jsxEscape(content: ChildType): Promise<string> {
//   return "";
// }

export { Fragment, jsx, jsx as jsxs };
