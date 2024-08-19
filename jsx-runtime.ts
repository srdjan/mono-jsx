import type { jsx as jsxFn } from "./types/jsx-runtime.d.ts";
import type { Child } from "mono-jsx";
import { Fragment, h } from "mono-jsx";

const normalizeProps = (
  props: Record<string, unknown>,
  key: string | number | undefined,
  jsxs: boolean,
) => {
  if (key !== undefined) {
    props["key"] = key;
  }
  const children = props.children;
  delete props["children"];
  return (jsxs ? children : children ? [children] : []) as Child[];
};

const jsx: typeof jsxFn = (tag, props, key) => h(tag, props, ...normalizeProps(props, key, false));
const jsxs: typeof jsxFn = (tag, props, key) => h(tag, props, ...normalizeProps(props, key, true));
const jsxDEV: typeof jsxFn = (tag, props, key) => h(tag, props, ...normalizeProps(props, key, Array.isArray(props.children)));

export { Fragment, jsx, jsxDEV, jsxs };
