// deno-lint-ignore-file prefer-const
/// <reference lib="dom.iterable" />

type StateSlot = [
  slot: HTMLElement,
  toggleSlots: ChildNode[] | undefined,
  switchSlots: Map<number | string, ChildNode[]> | undefined,
];

const stateSlots = new Map<string, StateSlot[]>();
const stateProxy = Object.create(null);

customElements.define(
  "state-slot",
  class extends HTMLElement {
    connectedCallback() {
      let cur: ChildNode | null;
      let tpl: HTMLTemplateElement;
      let keyAttr: string | null;
      let key: string | number;
      let switchSlots: Map<string | number, ChildNode[]>;
      let childNodes: ChildNode[];
      let name = this.getAttribute("name")!;
      let slots = stateSlots.get(name);
      let state: StateSlot = [this, undefined, undefined];

      if (this.hasAttribute("toggle")) {
      } else if (this.hasAttribute("switch")) {
        switchSlots = state[2] = new Map<string | number, ChildNode[]>();
        cur = this;
        while ((cur = cur.nextSibling)) {
          if (cur.nodeType === 1 && (cur as Element).tagName === "TEMPLATE") {
            tpl = cur as HTMLTemplateElement;
            keyAttr = tpl.getAttribute("key");
            if (keyAttr) {
              key = /^\-?\d+$/.test(keyAttr) ? Number(keyAttr) : keyAttr;
              if (tpl.hasAttribute("matched")) {
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
              switchSlots.set(key, childNodes);
            }
            tpl.remove();
          }
        }
      }
      if (slots) {
        slots.push(state);
      } else {
        stateSlots.set(name, [state]);
      }
    }
  },
);

function createState(name: string, initialValue: any) {
  let value: any = initialValue;
  Object.defineProperty(stateProxy, name, {
    get: () => value,
    set: (newValue: any) => {
      if (newValue !== value) {
        const slots = stateSlots.get(name);
        if (slots) {
          for (const [slot, toggleSlots, switchSlots] of slots) {
            if (toggleSlots) {
            } else if (switchSlots) {
              const childNodes = switchSlots.get(String(value));
              const newChildNodes = switchSlots.get(String(newValue)) ?? switchSlots.get(-1);
              if (newChildNodes) {
                const tmp = document.createComment("");
                slot.after(tmp);
                childNodes?.forEach(node => node.remove());
                tmp.replaceWith(...newChildNodes);
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
