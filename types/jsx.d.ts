import type * as Mono from "./mono.d.ts";
import type { HTML } from "./html.d.ts";
export type { BaseCSSProperties, CSSProperties } from "./mono.d.ts";

export type ChildType = VNode | string | number | bigint | boolean | null;
export type Child = ChildType | ChildType[] | Generator<ChildType> | AsyncGenerator<ChildType>;

export type VNode =
  & {
    tag: string | symbol | FC<any>;
    props: Record<string, any> | null;
    children?: Child[];
    innerHTML?: string;
  }
  & Mono.Attributes
  & Mono.AsyncComponentAttributes;

export type PropsWithChildren<P extends Record<string, any> = {}> = P & { children?: Child[] };

export interface FC<P = PropsWithChildren<{}>> {
  (props: P): Child | Promise<ChildType | ChildType[]>;
  displayName?: string;
}
export type TC = (strings: TemplateStringsArray, ...values: any[]) => VNode;

export const h: (tag: string | FC<any>, props: Record<string, any> | null, ...children: Child[]) => VNode;
export const Fragment: FC<PropsWithChildren<{ key?: string | number }>>;
export const customElements: typeof JSX.customElements;
export const html: TC, css: TC, js: TC;

declare global {
  namespace JSX {
    type ElementType<P = any> =
      | {
        [K in keyof IntrinsicElements]: P extends IntrinsicElements[K] ? K : never;
      }[keyof IntrinsicElements]
      | FC<P>;
    interface Element extends VNode {}
    interface CustomElements {
      [key: `${string}-${string}`]: Record<string, any>;
    }
    interface IntrinsicAttributes extends Mono.Attributes, Mono.AsyncComponentAttributes {}
    interface IntrinsicElements extends HTML.Elements, HTML.SVGElements, Mono.Elements, CustomElements {}
    const customElements: {
      define(tagName: string, component: FC<any>): typeof customElements;
      define(elements: Record<string, FC<any>>): typeof customElements;
    };
  }
  // deno-lint-ignore no-var
  var html: TC, css: TC, js: TC;
}
