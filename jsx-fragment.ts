import type { PropsWithChildren, VNode } from "./types/jsx.d.ts";

export const $vnode = Symbol.for("jsx.VNode");
export const $fragment = Symbol.for("jsx.Fragment");

export const Fragment = ({ key, children }: PropsWithChildren<{ key?: string | number }>): VNode => [
  $fragment,
  key !== undefined ? { key } : null,
  children,
  $vnode,
];
