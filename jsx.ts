import type { VNode } from "./types/jsx.d.ts";

const $vnode = Symbol.for("jsx.vnode");
const $fragment = Symbol.for("jsx.fragment");
const $html = Symbol.for("jsx.html");
const $state = Symbol.for("mono.state");
const $computed = Symbol.for("mono.computed");
const iconsRegistry = new Map<string, string>();
const html = (raw: string, ...values: unknown[]): VNode => [$html, { innerHTML: String.raw({ raw }, ...values) }, $vnode];

let collectDeps: ((key: string) => void) | undefined;
const state: State = new Proxy(Object.create(null), {
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver);
    if (typeof key === "symbol") {
      return value;
    }
    if (collectDeps) {
      collectDeps(key);
      return value;
    }
    return [$state, { key, value }, $vnode];
  },
  set(target, key, value, receiver) {
    const vt = typeof value;
    // clone the value to prevent memory leak
    value = vt === "boolean" || vt === "number" || vt === "bigint" ? value : structuredClone(value);
    return Reflect.set(target, key, value, receiver);
  },
});
const computed = <T = unknown>(fn: () => T): T => {
  collectDeps = (key) => deps.add(key);
  const deps = new Set<string>();
  const value = fn();
  collectDeps = undefined;
  if (deps.size === 0) return value;
  return [$computed, { deps: Array.from(deps), value, fn: fn.toString() }, $vnode] as unknown as T;
};

// global variables
Object.assign(globalThis, { html, css: html, js: html, $state: state, $computed: computed });

export { $computed, $fragment, $html, $state, $vnode, iconsRegistry };
