declare global {
  var $cx: (className: unknown) => string;
  var $applyStyle: (el: Element, style: unknown) => void;
}

interface Signals {
  readonly $init: (key: string, value: unknown) => void;
  readonly $watch: (key: string, effect: () => void) => () => void;
}

let collectDeps: ((scopeId: number, key: string) => void) | undefined;

const win = window as any;
const mcs = new Map<number, [Function, string[]]>();
const scopes = new Map<number, Signals>();
const Signals = (scopeId: number) => scopes.get(scopeId) ?? scopes.set(scopeId, createSignals(scopeId)).get(scopeId)!;

const getAttr = (el: Element, name: string) => el.getAttribute(name);
const setAttr = (el: Element, name: string, value: string) => el.setAttribute(name, value);
const replaceChildren = (el: Element, children: Node[]) => el.replaceChildren(...children);
const createNullObject = () => Object.create(null);

const createSignals = (scopeId: number): Signals => {
  const store = createNullObject();
  const init = (key: string, value: unknown) => {
    store[key] = value;
  };

  const watchers = new Map<string, Set<(() => void)>>();
  const watch = (key: string, effect: () => void) => {
    let effects = watchers.get(key);
    if (!effects) {
      effects = new Set();
      watchers.set(key, effects);
    }
    effects.add(effect);
    return () => {
      effects.delete(effect);
      if (effects.size === 0) {
        watchers.delete(key);
      }
    };
  };

  const refs = new Proxy(createNullObject(), {
    get: (_target, prop: string) => document.querySelector("[data-ref='" + scopeId + ":" + prop + "']"),
  });

  return new Proxy(store, {
    get: (target, prop: string, receiver) => {
      switch (prop) {
        case "$init":
          return init;
        case "$watch":
          return watch;
        case "app":
          return Signals(0);
        case "refs":
          return refs;
        default:
          collectDeps?.(scopeId, prop);
          return Reflect.get(target, prop, receiver);
      }
    },
    set: (target, prop: string, value, receiver) => {
      if (value !== Reflect.get(target, prop, receiver)) {
        const effects = watchers.get(prop);
        if (effects) {
          queueMicrotask(() => effects.forEach((fn) => fn()));
        }
        return Reflect.set(target, prop, value, receiver);
      }
      return false;
    },
  }) as Signals;
};

const createDomEffect = (el: Element, mode: string | null, getter: () => unknown) => {
  if (mode === "toggle") {
    let slots: Array<ChildNode> | undefined;
    return () => {
      if (!slots) {
        const firstChild = el.firstElementChild;
        if (firstChild && firstChild.tagName === "TEMPLATE" && firstChild.hasAttribute("m-slot")) {
          slots = [...(firstChild as HTMLTemplateElement).content.childNodes];
        } else {
          slots = [...el.childNodes];
        }
      }
      replaceChildren(el, getter() ? slots : []);
    };
  }
  if (mode === "switch") {
    let value: string;
    let toMatch = getAttr(el, "match");
    let slotsMap: Map<string, Array<ChildNode>> | undefined;
    let unnamedSlots: Array<ChildNode> | undefined;
    let getNamedSlots = (slotName: string) => slotsMap!.get(slotName) ?? slotsMap!.set(slotName, []).get(slotName)!;
    return () => {
      if (!slotsMap) {
        slotsMap = new Map();
        unnamedSlots = [];
        for (const slot of el.childNodes) {
          if (slot.nodeType === 1 && (slot as HTMLElement).tagName === "TEMPLATE" && (slot as HTMLElement).hasAttribute("m-slot")) {
            for (const node of (slot as HTMLTemplateElement).content.childNodes) {
              if (node.nodeType === 1 && (node as HTMLElement).hasAttribute("slot")) {
                getNamedSlots(getAttr(node as HTMLElement, "slot")!).push(node);
              } else {
                unnamedSlots.push(node);
              }
            }
            slot.remove();
          } else {
            if (toMatch) {
              getNamedSlots(toMatch).push(slot);
            } else {
              unnamedSlots.push(slot);
            }
          }
        }
      }
      value = "" + getter();
      replaceChildren(el, slotsMap.has(value) ? slotsMap.get(value)! : unnamedSlots!);
    };
  }
  if (mode && mode.length > 2 && mode.startsWith("[") && mode.endsWith("]")) {
    let attrName = mode.slice(1, -1);
    let target: Element = el.parentElement!;
    if (target.tagName === "M-GROUP") {
      target = target.previousElementSibling!;
    }
    return () => {
      const value = getter();
      if (value === false || value === null || value === undefined) {
        target.removeAttribute(attrName);
      } else if (typeof value === "object" && value !== null && (attrName === "class" || attrName === "style" || attrName === "props")) {
        if (attrName === "class") {
          setAttr(target, attrName, $cx(value));
        } else if (attrName === "style") {
          $applyStyle(target, value);
        } else {
          setAttr(target, attrName, JSON.stringify(value));
        }
      } else {
        setAttr(target, attrName, value === true ? "" : value as string);
      }
    };
  }
  return () => el.textContent = "" + getter();
};

const resolveSignalID = (id: string): [scope: number, key: string] | null => {
  const i = id.indexOf(":");
  return i > 0 ? [Number(id.slice(0, i)), id.slice(i + 1)] : null;
};

const defer = async <T>(getter: () => T | undefined) => {
  const v = getter();
  if (v !== undefined) {
    return v;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  return defer(getter);
};

const defineElement = (tag: string, callback: (el: Element & { disposes: (() => void)[] }) => void) =>
  customElements.define(
    tag,
    class extends HTMLElement {
      disposes: (() => void)[] = [];
      connectedCallback() {
        callback(this);
      }
      disconnectedCallback() {
        this.disposes.forEach((dispose) => dispose());
        this.disposes.length = 0;
      }
    },
  );

defineElement("m-signal", (el) => {
  const signals = Signals(Number(getAttr(el, "scope")));
  const key = getAttr(el, "key");
  if (key) {
    el.disposes.push(signals.$watch(key, createDomEffect(el, getAttr(el, "mode"), () => (signals as any)[key])));
  } else {
    const id = Number(getAttr(el, "computed"));
    defer(() => mcs.get(id)).then(([compute, deps]) => {
      const effect = createDomEffect(el, getAttr(el, "mode"), compute.bind(signals));
      deps.forEach((dep) => {
        const [scope, key] = resolveSignalID(dep)!;
        el.disposes.push(Signals(scope).$watch(key, effect));
      });
    });
  }
});

defineElement("m-effect", (el) => {
  const { disposes } = el;
  const scope = Number(getAttr(el, "scope"));
  const n = Number(getAttr(el, "n"));
  const cleanups: ((() => void) | undefined)[] = new Array(n);
  disposes.push(() => {
    cleanups.forEach((cleanup) => typeof cleanup === "function" && cleanup());
    cleanups.length = 0;
  });
  for (let i = 0; i < n; i++) {
    const fname = "$ME_" + scope + "_" + i;
    defer<Function>(() => win[fname]).then((fn) => {
      const deps: [number, string][] = [];
      const signals = Signals(scope);
      const effect = () => {
        cleanups[i] = fn.call(signals);
      };
      collectDeps = (scope, key) => deps.push([scope, key]);
      effect();
      collectDeps = undefined;
      for (const [scope, key] of deps) {
        disposes.push(Signals(scope).$watch(key, effect));
      }
    }, () => {});
  }
});

// get the signals
win.$signals = (scope?: number) => scope !== undefined ? Signals(scope) : undefined;

// initialize a signal with the given value
win.$MS = (id: string, value: unknown) => {
  const [scope, key] = resolveSignalID(id)!;
  Signals(scope).$init(key, value);
};

// define a computed signal
win.$MC = (id: number, compute: Function, deps: string[]) => {
  mcs.set(id, [compute, deps]);
};

// update an object with patches
win.$patch = (obj: Record<string, unknown>, ...patches: unknown[][]) => {
  for (const [value, ...path] of patches) {
    const key = path.pop()!;
    let target = obj;
    for (const p of path) {
      target = (target as any)[p as string];
    }
    target[key as string] = value;
  }
  return obj;
};
