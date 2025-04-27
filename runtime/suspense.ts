/// <reference lib="dom.iterable" />

const portals: Record<string, HTMLElement> = {};
const getChunkId = (el: HTMLElement) => el.getAttribute("chunk-id");

defineCustomElement("m-portal", (el) => {
  portals[getChunkId(el)!] = el;
});

defineCustomElement("m-chunk", (el) => {
  const id = getChunkId(el)!;
  const portal = portals[id];
  if (portal) {
    // set a timeout to wait for the element to be fully parsed
    setTimeout(() => {
      portal.replaceWith(...(el.firstChild as HTMLTemplateElement).content.childNodes);
      delete portals[id];
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
