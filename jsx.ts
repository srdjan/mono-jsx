import type { Child, FC, PropsWithChildren, VNode } from "./types/jsx.d.ts";

const symFragment = Symbol.for("jsx.Fragment");
const isFC = (v: unknown): v is FC => typeof v === "function";
const stripProps = (props: Record<string, unknown>, ...keys: string[]) => {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(props, key)) {
      result[key] = props[key];
      delete props[key];
    }
  }
  return result;
};

const h = (tag: string | FC<any>, props: Record<string, any> | null, ...children: Child[]) => {
  const vnode: VNode = { tag, props };
  if (children.length > 0) {
    vnode.children = children;
  }
  if (props) {
    Object.assign(
      vnode,
      stripProps(props, "catch", "eager", "innerHTML", "key", "pending", "route", "slot"),
    );
  }
  return vnode;
};

const Fragment = ({ key, children }: PropsWithChildren<{ key?: string | number }>) => ({
  tag: symFragment,
  props: null,
  children,
  key,
});

const customElements: Record<string, any> = {
  define: (tagName: string | object, component?: CallableFunction) => {
    if (typeof tagName === "object" && tagName !== null) {
      for (const [key, value] of Object.entries(tagName)) {
        if (isFC(value)) {
          customElements[key] = value;
        }
      }
    } else if (typeof tagName === "string" && isFC(component)) {
      customElements[tagName] = component;
    }
    return customElements;
  },
};

const html = (raw: string, ...values: any[]) => ({ tag: symFragment, props: null, innerHTML: String.raw({ raw }, ...values) });
const css = html;
const js = html;
Object.assign(globalThis, { JSX: { customElements }, html, css, js });

export type * from "./types/jsx.d.ts";
export { css, customElements, Fragment, h, html, js };
