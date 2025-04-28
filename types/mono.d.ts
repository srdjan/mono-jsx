// deno-lint-ignore-file no-explicit-any

import type * as CSS from "./css.d.ts";

type Num1_9 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Num0_100 = 0 | Num1_9 | `${Num1_9}${0 | Num1_9}` | 100;

export interface BaseCSSProperties extends CSS.Properties<string | number> {}

export interface AtRuleCSSProperties {
  [key: `@container${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@media${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@supports${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@keyframes ${string}`]: {
    [key in "from" | "to" | `${Num0_100}%`]?: BaseCSSProperties;
  };
}

export interface PseudoCSSProperties {
  ":active"?: BaseCSSProperties;
  ":link"?: BaseCSSProperties;
  ":visited"?: BaseCSSProperties;
  ":checked"?: BaseCSSProperties;
  ":disabled"?: BaseCSSProperties;
  ":enable"?: BaseCSSProperties;
  ":empty"?: BaseCSSProperties;
  ":first"?: BaseCSSProperties;
  ":first-child"?: BaseCSSProperties;
  ":first-of-type"?: BaseCSSProperties;
  ":focus"?: BaseCSSProperties;
  ":focus-visible"?: BaseCSSProperties;
  ":focus-within"?: BaseCSSProperties;
  ":fullscreen"?: BaseCSSProperties;
  ":hover"?: BaseCSSProperties;
  ":in-range"?: BaseCSSProperties;
  ":out-of-range"?: BaseCSSProperties;
  ":indeterminate"?: BaseCSSProperties;
  ":invalid"?: BaseCSSProperties;
  ":last-child"?: BaseCSSProperties;
  ":last-of-type"?: BaseCSSProperties;
  ":only-child"?: BaseCSSProperties;
  ":only-of-type"?: BaseCSSProperties;
  ":optional"?: BaseCSSProperties;
  "::after"?: BaseCSSProperties;
  "::backdrop"?: BaseCSSProperties;
  "::before"?: BaseCSSProperties;
  "::first-letter"?: BaseCSSProperties;
  "::first-line"?: BaseCSSProperties;
  "::placeholder"?: BaseCSSProperties;
  "::selection"?: BaseCSSProperties;
  "::view-transition"?: BaseCSSProperties;
  [key: `:has(${string})`]: BaseCSSProperties;
  [key: `:is(${string})`]: BaseCSSProperties;
  [key: `:lang(${string})`]: BaseCSSProperties;
  [key: `:not(${string})`]: BaseCSSProperties;
  [key: `:nth-child(${string})`]: BaseCSSProperties;
  [key: `:nth-last-child(${string})`]: BaseCSSProperties;
  [key: `:nth-of-type(${string})`]: BaseCSSProperties;
  [key: `::view-transition-group(${string})`]: BaseCSSProperties;
  [key: `::view-transition-image-pair(${string})`]: BaseCSSProperties;
  [key: `::view-transition-new(${string})`]: BaseCSSProperties;
  [key: `::view-transition-old(${string})`]: BaseCSSProperties;
}

export interface CSSProperties extends BaseCSSProperties, AtRuleCSSProperties, PseudoCSSProperties {
  [key: `&${" " | "." | "["}${string}`]: CSSProperties;
}

export type ChildType = JSX.Element | string | number | bigint | boolean | null;

export interface BaseAttributes {
  children?: ChildType | (ChildType)[];
  key?: string | number;
  slot?: string;
}

export interface AsyncComponentAttributes {
  rendering?: "eager";
  placeholder?: JSX.Element | string;
  catch?: (err: any) => JSX.Element;
}

export interface Elements {
  toggle: {
    value: boolean;
  };
  switch: {
    value?: string;
    defaultValue?: string;
  };
  cache: {
    /** The cache key is used to identify the cache. */
    key: string;
    /** The `etag` (or **entity tag**) is an identifier for a specific version of a rendering cache. */
    etag?: string;
    /** The `max-age=N` prop indicates that the cache remains fresh until N seconds after the cache is generated. */
    maxAge?: number;
    /** The `stale-while-revalidate` prop indicates that the cache could reuse a stale rendering while it revalidates it to a cache. */
    swr?: number;
  };
}

declare global {
  type FC<T = Record<string, unknown>, Context = Record<string, unknown>> = {
    context: Context;
    request: Request;
    computed: <V = unknown>(fn: () => V) => V;
  } & Omit<T, "request" | "computed">;
}
