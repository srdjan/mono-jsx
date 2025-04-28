const stateMap = new Map<number, ReturnType<typeof createState>>();
const getState = (fc: number) => stateMap.get(fc) ?? stateMap.set(fc, createState(fc)).get(fc)!;
const attr = (el: Element, name: string) => el.getAttribute(name);
const hasAttr = (el: Element, name: string) => el.hasAttribute(name);

const createState = (fc: number) => {
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

  if (fc > 0) {
    Object.defineProperty(store, "app", { get: () => getState(0).store, enumerable: false, configurable: false });
  }

  return { store, define, watch };
};

const createEffect = (el: HTMLElement, mode: string | null, getter: () => unknown) => {
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
        // @ts-ignore - `cx` and `styleToCSS` are injected by the renderer
        target.setAttribute(attrName, attrName === "class" ? cx(value) : styleToCSS(value));
      } else {
        target.setAttribute(attrName, value === true ? "" : "" + value);
      }
    };
  }
  return () => el.textContent = "" + getter();
};

const resolveStateKey = (key: string): [fc: number, key: string] => {
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
      const state = getState(Number(attr(el, "fc")!));
      const mode = attr(el, "mode");
      const key = attr(el, "key");
      if (key) {
        state.watch(key, createEffect(el, mode, () => state.store[key]));
      } else if (hasAttr(el, "computed")) {
        // set a timeout to wait for the element to be fully parsed
        setTimeout(() => {
          const firstChild = el.firstChild;
          if (firstChild && firstChild.nodeType === 1 && (firstChild as HTMLScriptElement).type === "computed") {
            const js = (firstChild as HTMLScriptElement).textContent;
            if (js) {
              new Function("$", js).call(
                state.store,
                (getter: () => unknown, deps: string[]) => {
                  const effect = createEffect(el, mode, getter);
                  for (const dep of deps) {
                    const [fc, key] = resolveStateKey(dep);
                    getState(fc).watch(key, effect);
                  }
                },
              );
            }
          }
        });
      }
    }
  },
);

Object.assign(globalThis, {
  $state: (fc?: number) => fc !== undefined ? getState(fc).store : undefined,
  $defineState: (id: string, value: unknown) => {
    const [fc, key] = resolveStateKey(id);
    getState(fc).define(key, value);
  },
});
