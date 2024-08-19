import type { FC, VNode } from "./jsx.d.ts";

export function jsx(
  tag: string | FC<any>,
  props: Record<string, unknown>,
  key?: string | number,
): VNode;

export { Fragment } from "./jsx.d.ts";
export { jsx as jsxDEV, jsx as jsxs };
