import { $computed, $state, $vnode } from "./symbols.ts";

let collectDeps: ((key: string) => void) | undefined;

export const state: State = new Proxy(Object.create(null), {
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

export const computed = <T = unknown>(fn: () => T): T => {
  collectDeps = (key) => deps.add(key);
  const deps = new Set<string>();
  const value = fn();
  collectDeps = undefined;
  if (deps.size === 0) return value;
  return [$computed, { value, deps: Array.from(deps), fn: fn.toString() }, $vnode] as unknown as T;
};
