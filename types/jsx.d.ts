import type * as Mono from "./mono.d.ts";
import type { HTML } from "./html.d.ts";

declare global {
  namespace JSX {
    type ElementType<P = any> =
      | {
        [K in keyof IntrinsicElements]: P extends IntrinsicElements[K] ? K : never;
      }[keyof IntrinsicElements]
      | FC<P>;
    interface Element extends VNode, Response {}
    interface IntrinsicAttributes extends Mono.BaseAttributes, Mono.AsyncComponentAttributes {}
    interface IntrinsicElements extends HTML.Elements, HTML.SVGElements, Mono.Elements {}
  }
  // deno-lint-ignore no-var
  var html: TC, css: TC, js: TC;
}

export type ChildType = VNode | string | number | bigint | boolean | null;
export type Children = (ChildType | ChildType[])[];

export type VNode = [
  tag: string | symbol | FC<any>,
  props: Record<string, any> | null,
  children: Children | null,
  nodeType: symbol,
];

export type PropsWithChildren<P extends Record<string, any> = {}> = P & { children: Children };

export interface FC<P = PropsWithChildren<{}>> {
  (props: P): ChildType | Promise<ChildType> | Generator<ChildType> | AsyncGenerator<ChildType>;
  displayName?: string;
  rendering?: string;
}
export type TC = (strings: TemplateStringsArray, ...values: any[]) => VNode;

export const h: (tag: string | FC<any>, props: Record<string, any> | null, ...children: Children) => VNode;
export const Fragment: FC<PropsWithChildren<{ key?: string | number }>>;
export const html: TC, css: TC, js: TC;

export type * from "./render.d.ts";
