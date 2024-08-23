import type { ChildType, FC, VNode } from "./types/jsx.d.ts";
import { Fragment, h } from "./jsx.ts";

function normalizeProps(
  props: Record<string, unknown>,
  key: string | number | undefined,
  jsxs: boolean,
) {
  if (key !== undefined) {
    props["key"] = key;
  }
  const children = props.children;
  delete props["children"];
  return (jsxs ? children : children ? [children] : []) as ChildType[];
}

interface jsxFn {
  (tag: string | FC<any>, props: Record<string, unknown>, key?: string | number): VNode;
}

const jsx: jsxFn = (tag, props, key) => h(tag, props, ...normalizeProps(props, key, false));
const jsxs: jsxFn = (tag, props, key) => h(tag, props, ...normalizeProps(props, key, true));
const jsxDEV: jsxFn = (tag, props, key) => h(tag, props, ...normalizeProps(props, key, Array.isArray(props.children)));

export { Fragment, jsx, jsxDEV, jsxs };
