import type { VNode } from "./jsx.d.ts";

export interface RenderOptions {
  request?: Request;
  headers?: HeadersInit;
}

export function iconify(name: string, svg: string): string;
export function render(node: VNode, renderOptions?: RenderOptions): ReadableStream<Response>;
