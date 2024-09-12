import type { FC, VNode } from "./jsx.d.ts";

export function jsx(
  tag: string | FC,
  props: Record<string, unknown>,
  key?: string | number,
): VNode;

export function Fragment(props: Record<string, unknown>): VNode;

export { jsx as jsxs };
