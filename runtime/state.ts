// deno-lint-ignore-file prefer-const
/// <reference lib="dom.iterable" />

type StateSlot = [
  slot: HTMLElement,
  toggleSlots: ChildNode[] | undefined,
  switchSlots: Map<number | string, ChildNode[]> | undefined,
  switchDefaultSlot: ChildNode[] | undefined,
];

const stateSlots = new Map<string, StateSlot[]>();
const stateProxy = Object.create(null);
const attr = (el: Element, name: string) => el.getAttribute(name);
const hasAttr = (el: Element, name: string) => el.hasAttribute(name);

defineCustomElement("mono-state", el => {
  defineStateSlot(attr(el, "name")!, [el] as unknown as StateSlot);
});

defineCustomElement("mono-toggle", el => {
  defineStateSlot(attr(el, "name")!, [el] as unknown as StateSlot);
});

defineCustomElement("mono-switch", el => {
  let ss = new Array(4).fill(undefined) as unknown as StateSlot;
  let cur: ChildNode | null;
  let childNodes: ChildNode[];
  let tpl: HTMLTemplateElement;
  let key: string | number;
  let index = -1;
  let switchSlots = new Map<string | number, ChildNode[]>();
  ss[2] = switchSlots;
  cur = el;
  while ((cur = cur.nextSibling)) {
    if (cur.nodeType === 1 && (cur as Element).tagName === "TEMPLATE") {
      tpl = cur as HTMLTemplateElement;
      if (hasAttr(tpl, "leading")) {
        childNodes = [];
        while ((cur = cur.nextSibling)) {
          if (cur.nodeType === 8 && (cur as Comment).data === "/") {
            (cur as Comment).remove();
            break;
          }
          childNodes.push(cur as ChildNode);
        }
      } else {
        childNodes = Array.from(tpl.content.childNodes);
      }
      if (hasAttr(tpl, "default")) {
        ss[3] = childNodes;
      } else {
        index++;
        key = hasAttr(tpl, "key") ? attr(tpl, "key")! : index;
        switchSlots.set(key, childNodes);
      }
      tpl.remove();
    }
  }
  defineStateSlot(attr(el, "name")!, ss);
});

function defineCustomElement(tag: string, connectedCallback: (el: HTMLElement) => void) {
  customElements.define(
    tag,
    class extends HTMLElement {
      connectedCallback() {
        connectedCallback(this);
      }
    },
  );
}

function defineStateSlot(name: string, stateSlot: StateSlot) {
  const slots = stateSlots.get(name);
  if (slots) {
    slots.push(stateSlot);
  } else {
    stateSlots.set(name, [stateSlot]);
  }
}

function createState(name: string, initialValue: any) {
  let value: any = initialValue;
  Object.defineProperty(stateProxy, name, {
    get: () => value,
    set: (newValue: any) => {
      if (newValue !== value) {
        const slots = stateSlots.get(name);
        if (slots) {
          for (const [slot, toggleSlots, switchSlots, switchDefaultSlot] of slots) {
            if (toggleSlots) {
            } else if (switchSlots) {
              const childNodes = switchSlots.get(String(value));
              const newChildNodes = switchSlots.get(String(newValue)) || switchDefaultSlot;
              if (childNodes) {
                childNodes.forEach(node => node.remove());
              }
              if (newChildNodes) {
                slot.after(...newChildNodes);
              }
            } else {
              const nextSibling = slot.nextSibling;
              if (nextSibling && nextSibling.nodeType === 3) {
                (nextSibling as Text).replaceWith(String(newValue));
              } else {
                slot.after(String(newValue));
              }
            }
          }
        }
        value = newValue;
      }
    },
  });
}

Object.assign(globalThis, {
  createState,
  state: stateProxy,
});
