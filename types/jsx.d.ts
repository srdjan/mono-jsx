// deno-lint-ignore-file no-explicit-any

import type * as Mono from "./mono.d.ts";
import type { HTML } from "./html.d.ts";

export type ChildType = VNode | VNode[] | string | number | bigint | boolean | null;

export type VNode = readonly [
  tag: string | symbol | FC<any>,
  props: Record<string, any>,
  $vnode: symbol,
];

export interface FC<P = {}> {
  (props: P): ChildType | Promise<ChildType> | Generator<ChildType> | AsyncGenerator<ChildType>;
  rendering?: string;
}

declare global {
  namespace JSX {
    type ElementType<P = any> =
      | {
        [K in keyof IntrinsicElements]: P extends IntrinsicElements[K] ? K : never;
      }[keyof IntrinsicElements]
      | FC<P>;
    type Raw = (strings: TemplateStringsArray, ...values: unknown[]) => JSX.Element;
    interface Element extends VNode, Response {}
    interface IntrinsicAttributes extends Mono.BaseAttributes, Mono.AsyncComponentAttributes {}
    interface IntrinsicElements extends HTML.Elements, HTML.SVGElements, Mono.Elements {}
  }
}
