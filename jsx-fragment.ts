import type { Children, VNode } from "./types/jsx.d.ts";

export const $vnode = Symbol.for("jsx.VNode");
export const $fragment = Symbol.for("jsx.Fragment");

export const Fragment = ({ key, children }: { children: Children | null; key?: string | number }): VNode => [
  $fragment,
  key !== undefined ? { key } : null,
  children,
  $vnode,
];
