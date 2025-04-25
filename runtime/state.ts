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
    let value: string;
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
      value = getter() as string;
      el.innerHTML = "";
      el.append(...(slotsMap.has(value) ? slotsMap.get(value)! : unnamedSlots!));
    };
  } else if (mode.length > 2 && mode.startsWith("[") && mode.endsWith("]")) {
    let attrName = mode.slice(1, -1);
    let target: Element = el.parentElement!;
    if (target.tagName === "M-GROUP") {
      target = target.previousElementSibling!;
    }
    effect = () => {
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
      const mode = attr(el, "mode") ?? "text";
      const key = attr(el, "key");
      if (key) {
        createEffect(el, mode, () => $state[key], [key]);
      } else {
        // here we use a timeout to ensure that the script is executed after the element is fully parsed
        setTimeout(() => {
          const firstChild = el.firstChild;
          if (firstChild && firstChild.nodeType === 1 && (firstChild as HTMLScriptElement).type === "computed") {
            const js = (firstChild as HTMLScriptElement).textContent;
            if (js) {
              (new Function("$state", "$", js))($state, (getter: () => unknown, deps: string[]) => {
                createEffect(el, mode, getter, deps);
              });
            }
          }
        }, 0);
      }
    }
  },
);

Object.assign(globalThis, {
  $state,
  defineState,
});
