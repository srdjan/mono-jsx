import type { FC, VNode } from "./types/jsx.d.ts";
import { $fragment, $vnode } from "./jsx.ts";
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
    if (props) {
      for (const key of ["request", "headers"]) {
        if (Object.hasOwn(props, key)) {
          renderOptions[key] = props[key];
          delete props[key];
        }
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

export { $fragment as Fragment, jsx, jsx as jsxs };
