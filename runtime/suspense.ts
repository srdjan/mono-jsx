const slots = new Map<string, HTMLElement>();
const getChunkId = (el: HTMLElement) => el.getAttribute("chunk-id");

defineCustomElement("suspense-slot", (el) => {
  const id = getChunkId(el);
  if (id) {
    slots.set(id, el);
  }
});

defineCustomElement("suspense-chunk", (el) => {
  let slot = slots.get(getChunkId(el)!);
  let placeholder: ChildNode[];
  let cur: ChildNode | null;
  if (slot) {
    if (slot.hasAttribute("with-placeholder")) {
      placeholder = [];
      cur = slot;
      while ((cur = cur.nextSibling)) {
        placeholder.push(cur);
        if (cur.nodeType === 8 && (cur as Comment).data === "/") {
          break;
        }
      }
      placeholder.forEach((node) => node.remove());
    }
    setTimeout(() => {
      slot.replaceWith(...el.childNodes);
      el.remove();
    });
  }
});

function defineCustomElement(tagName: string, connectedCallback: (el: HTMLElement) => void) {
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback() {
        connectedCallback(this);
      }
    },
  );
}
