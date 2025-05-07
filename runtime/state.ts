const stateMap = new Map<number, ReturnType<typeof createState>>();
const getState = (id: number) => stateMap.get(id) ?? stateMap.set(id, createState(id)).get(id)!;
const attr = (el: Element, name: string) => el.getAttribute(name);
const hasAttr = (el: Element, name: string) => el.hasAttribute(name);

const createState = (id: number) => {
  const store = Object.create(null);
  const effectMap = new Map<string, (() => void)[]>();

  const define = (name: string, initialValue: unknown) => {
    let value: unknown = initialValue;
    Object.defineProperty(store, name, {
      get: () => value,
      set: (newValue: unknown) => {
        if (newValue !== value) {
          const effects = effectMap.get(name);
          if (effects) {
            queueMicrotask(() => effects.forEach((fn) => fn()));
          }
          value = newValue;
        }
      },
    });
  };

  const watch = (key: string, effect: () => void) => {
    let effects = effectMap.get(key);
    if (!effects) {
      effects = [];
      effectMap.set(key, effects);
    }
    effects.push(effect);
  };

  if (id > 0) {
    Object.defineProperty(store, "app", { get: () => getState(0).store, enumerable: false, configurable: false });
  }

  return { store, define, watch };
};

const createEffect = (el: Element, mode: string | null, getter: () => unknown) => {
  if (mode === "toggle") {
    let slots: NodeListOf<ChildNode> | undefined;
    return () => {
      if (!slots) {
        const firstChild = el.firstElementChild;
        if (firstChild && firstChild.tagName === "TEMPLATE" && hasAttr(firstChild, "m-slot")) {
          slots = (firstChild as HTMLTemplateElement).content.childNodes;
          el.innerHTML = "";
        } else {
          slots = el.childNodes;
        }
      }
      if (getter()) {
        el.append(...slots);
      } else {
        el.innerHTML = "";
      }
    };
  }
  if (mode === "switch") {
    let matchedSlotName = attr(el, "match");
    let slotsMap: Map<string, Array<ChildNode>> | undefined;
    let unnamedSlots: Array<ChildNode> | undefined;
    let getNamedSlots = (slotName: string) => slotsMap!.get(slotName) ?? slotsMap!.set(slotName, []).get(slotName)!;
    let value: string;
    return () => {
      if (!slotsMap) {
        slotsMap = new Map();
        unnamedSlots = [];
        for (const slot of el.childNodes) {
          if (slot.nodeType === 1 && (slot as HTMLElement).tagName === "TEMPLATE" && hasAttr(slot as HTMLElement, "m-slot")) {
            for (const node of (slot as HTMLTemplateElement).content.childNodes) {
              if (node.nodeType === 1 && hasAttr(node as HTMLElement, "slot")) {
                getNamedSlots(attr(node as HTMLElement, "slot")!).push(node);
              } else {
                unnamedSlots.push(node);
              }
            }
            slot.remove();
          } else {
            if (matchedSlotName) {
              getNamedSlots(matchedSlotName).push(slot);
            } else {
              unnamedSlots.push(slot);
            }
          }
        }
      }
      value = getter() as string;
      el.innerHTML = "";
      el.append(...(slotsMap.has(value) ? slotsMap.get(value)! : unnamedSlots!));
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
      if (value === false) {
        target.removeAttribute(attrName);
      } else if ((attrName === "class" || attrName === "style") && value && typeof value === "object") {
        // @ts-ignore - `$cx` and `$styleToCSS` are injected by the renderer
        target.setAttribute(attrName, attrName === "class" ? $cx(value) : $styleToCSS(value));
      } else {
        target.setAttribute(attrName, value === true ? "" : "" + value);
      }
    };
  }
  return () => el.textContent = "" + getter();
};

const resolveStateKey = (key: string): [id: number, key: string] => {
  const i = key.indexOf(":");
  if (i > 0) {
    return [Number(key.slice(0, i)), key.slice(i + 1)];
  }
  throw new Error("Invalid state key");
};

customElements.define(
  "m-state",
  class extends HTMLElement {
    connectedCallback() {
      const el = this;
      const key = attr(el, "key");
      if (key) {
        const state = getState(Number(attr(el, "fc")!));
        state.watch(key, createEffect(el, attr(el, "mode"), () => state.store[key]));
        return;
      }
    }
  },
);

Object.assign(window, {
  $state: (id?: number) => id !== undefined ? getState(id).store : undefined,
  $defineState: (stateKey: string, value: unknown) => {
    const [id, key] = resolveStateKey(stateKey);
    getState(id).define(key, value);
  },
  $defineComputed: (id: string, compute: Function, deps: string[]) => {
    const el = document.querySelector("m-state[computed='" + id + "']");
    if (el) {
      const scope = getState(Number(attr(el, "fc")!)).store;
      const effect = createEffect(el, attr(el, "mode"), compute.bind(scope));
      for (const dep of deps) {
        const [id, key] = resolveStateKey(dep);
        getState(id).watch(key, effect);
      }
    }
  },
});
