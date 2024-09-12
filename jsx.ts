import type { VNode } from "./types/jsx.d.ts";

const $vnode = Symbol.for("jsx.vnode");
const $fragment = Symbol.for("jsx.fragment");
const $html = Symbol.for("jsx.html");
const html = (raw: string, ...values: any[]): VNode => [$html, { innerHTML: String.raw({ raw }, ...values) }, $vnode];
const css = html;
const js = html;
const state = Object.create(null);

// global variables
Object.assign(globalThis, { html, css, js, state });

export { $fragment, $html, $vnode, css, html, js };
