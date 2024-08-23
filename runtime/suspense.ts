createCustomElement("suspense-slot", (el) => {
  const slot = el.attachShadow({ mode: "open" });
  slot.innerHTML = "<slot></slot>";
});

createCustomElement("suspense-chunk", (el) => {
  const slot = el.attachShadow({ mode: "open" });
  slot.innerHTML = "<slot></slot>";
});

function createCustomElement(tag: string, connectedCallback: (el: HTMLElement) => void) {
  customElements.define(
    tag,
    class extends HTMLElement {
      connectedCallback() {
        connectedCallback(this);
      }
    },
  );
}
