import type { FC, VNode } from "./types/jsx.d.ts";

const $vnode = Symbol.for("jsx.VNode");
const $fragment = Symbol.for("jsx.Fragment");
const Fragment: FC = (props): VNode => [$fragment, props, $vnode];
const html = (raw: string, ...values: any[]): VNode => [$fragment, { innerHTML: String.raw({ raw }, ...values) }, $vnode];
const css = html;
const js = html;
const state = Object.create(null);

// global functions
Object.assign(globalThis, { html, css, js, state });

export { $fragment, $vnode, css, Fragment, html, js };
