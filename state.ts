import { $computed, $state, $vnode } from "./symbols.ts";

let collectDeps: ((fc: number, key: string, value: unknown) => void) | undefined;

export function createState(
  fc: number,
  appState: Record<string, unknown> | null,
  context?: Record<string, unknown>,
  request?: Request,
): Record<string, unknown> {
  const computed = <T = unknown>(fn: () => T): T => {
    const deps = Object.create(null) as Record<string, unknown>;
    collectDeps = (fc, key, value) => deps[fc + ":" + key] = value;
    const value = fn();
    collectDeps = undefined;
    if (value instanceof Promise || deps.size === 0) return value;
    return [$computed, { value, deps, fn: fn.toString(), fc }, $vnode] as unknown as T;
  };

  return new Proxy(Object.create(null), {
    get(target, key, receiver) {
      switch (key) {
        case "app":
          return appState;
        case "context":
          return context ?? {};
        case "request":
          if (!request) {
            throw new Error("request is not defined");
          }
          return request;
        case "computed":
          return computed;
        default: {
          const value = Reflect.get(target, key, receiver);
          if (typeof key === "symbol") {
            return value;
          }
          if (collectDeps) {
            collectDeps(fc, key, value);
            return value;
          }
          return [$state, { key, value, fc }, $vnode];
        }
      }
    },
    set(target, key, value, receiver) {
      return Reflect.set(target, key, value, receiver);
    },
  });
}
