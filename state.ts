import { $computed, $state, $vnode } from "./symbols.ts";

export function createState(request?: Request): Record<string, unknown> {
  let collectDeps: ((key: string, value: unknown) => void) | undefined;

  const computed = <T = unknown>(fn: () => T): T => {
    const deps = Object.create(null) as Record<string, unknown>;
    collectDeps = (key, value) => deps[key] = value;
    const value = fn();
    collectDeps = undefined;
    if (deps.size === 0) return value;
    return [$computed, { value, deps, fn: fn.toString() }, $vnode] as unknown as T;
  };

  return new Proxy(Object.create(null), {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (key === "request") {
        if (!request) {
          throw new Error("request is not defined");
        }
        return request;
      }
      if (key === "computed") {
        return computed;
      }
      if (typeof key === "symbol") {
        return value;
      }
      if (collectDeps) {
        collectDeps(key, value);
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
}
