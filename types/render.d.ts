import type { VNode } from "./jsx.d.ts";

export interface RenderOptions {
  request?: Request;
  headers?: {
    [key: string]: string | undefined;
    contentSecurityPolicy?: string;
    cacheControl?: "public, max-age=31536000, immutable" | "private, max-age=0, must-revalidate" | (string & {});
    eTag?: string;
    lastModified?: string;
    setCookie?: string;
  };
}

export function iconify(name: string, svg: string): string;
export function render(node: VNode, renderOptions?: RenderOptions): ReadableStream<Response>;
