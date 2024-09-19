const $state = Object.create(null);
const effectMap = new Map<string, (() => void)[]>();
const attr = (el: Element, name: string) => el.getAttribute(name);
const hasAttr = (el: Element, name: string) => el.hasAttribute(name);

function createEffect(el: HTMLElement, mode: string, getter: () => unknown, deps: string[]) {
  let effect: undefined | (() => void);
  if (mode === "text") {
    effect = () => el.textContent = "" + getter();
  } else if (mode === "toggle") {
    let slots: NodeListOf<ChildNode> | undefined;
    effect = () => {
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
  } else if (mode === "switch") {
    let matchedSlotName = attr(el, "match");
    let slotsMap: Map<string, Array<ChildNode>> | undefined;
    let unnamedSlots: Array<ChildNode> | undefined;
    let getNamedSlots = (slotName: string) => slotsMap!.get(slotName) ?? slotsMap!.set(slotName, []).get(slotName)!;
    effect = () => {
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
      el.innerHTML = "";
      const value = getter();
      if (typeof value === "string" && slotsMap.has(value)) {
        el.append(...slotsMap.get(value)!);
      } else {
        el.append(...unnamedSlots!);
      }
    };
  } else if (mode.length > 2 && mode.startsWith("[") && mode.endsWith("]")) {
    const attrName = mode.slice(1, -1);
    const parent = el.parentElement!;
    effect = () => {
      const value = getter();
      if (value === false) {
        hasAttr(parent, attrName) && parent.removeAttribute(attrName);
      } else if ((attrName === "class" || attrName === "style") && value && typeof value === "object") {
        // todo: normalize class and style object
      } else {
        parent.setAttribute(attrName, value === true ? "" : "" + value);
      }
    };
  }
  if (effect) {
    for (const key of deps) {
      let effects = effectMap.get(key);
      if (!effects) {
        effects = [];
        effectMap.set(key, effects);
      }
      effects.push(effect);
    }
  }
}

function defineState(name: string, initialValue: unknown) {
  let value: unknown = initialValue;
  Object.defineProperty($state, name, {
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
}

customElements.define(
  "m-state",
  class extends HTMLElement {
    connectedCallback() {
      const el = this;
      const mode = attr(el, "mode") || "text";
      const use = attr(el, "use");
      if (use) {
        createEffect(el, mode, () => $state[use], [use]);
      } else {
        setTimeout(() => {
          const firstChild = el.firstChild;
          if (firstChild && firstChild.nodeType === 1 && (firstChild as HTMLScriptElement).type === "computed") {
            const js = (firstChild as HTMLScriptElement).textContent;
            if (js) {
              (new Function("$state", "$memo", js))($state, (memo: () => unknown, deps: string[]) => {
                createEffect(el, mode, memo, deps);
              });
            }
          }
        });
      }
    }
  },
);

Object.assign(globalThis, {
  $state,
  defineState,
});
