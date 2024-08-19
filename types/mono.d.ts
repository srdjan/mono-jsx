import type * as CSS from "./css.d.ts";

type Num1_9 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Num0_100 = 0 | Num1_9 | `${Num1_9}${0 | Num1_9}` | 100;
type TransitionProps = { delay?: number; ease?: CSS.DataType.EasingFunction };

export interface BaseCSSProperties extends CSS.Properties<string | number>, Partial<JSX.CustomCSSRules> {}

export interface AtRuleCSSProperties {
  [key: `@media${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@supports${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@keyframes ${string}`]: {
    [key in "from" | "to" | `${Num0_100}%`]?: BaseCSSProperties;
  };
}

export interface PseudoCSSProperties {
  ":active"?: BaseCSSProperties;
  ":focus"?: BaseCSSProperties;
  ":focus-visible"?: BaseCSSProperties;
  ":focus-within"?: BaseCSSProperties;
  ":hover"?: BaseCSSProperties;
  ":link"?: BaseCSSProperties;
  ":visited"?: BaseCSSProperties;
  ":checked"?: BaseCSSProperties;
  ":disabled"?: BaseCSSProperties;
  ":invalid"?: BaseCSSProperties;
  ":first-letter"?: BaseCSSProperties;
  ":first-line"?: BaseCSSProperties;
  ":first-child"?: BaseCSSProperties;
  ":first-of-type"?: BaseCSSProperties;
  ":last-child"?: BaseCSSProperties;
  ":last-of-type"?: BaseCSSProperties;
  "::after"?: BaseCSSProperties;
  "::backdrop"?: BaseCSSProperties;
  "::before"?: BaseCSSProperties;
  "::first-letter"?: BaseCSSProperties;
  "::placeholder"?: BaseCSSProperties;
  "::selection"?: BaseCSSProperties;
  [key: `:nth-child(${string})`]: BaseCSSProperties;
  [key: `:is(${string})`]: BaseCSSProperties;
  [key: `:not(${string})`]: BaseCSSProperties;
  [key: `:has(${string})`]: BaseCSSProperties;
}

export interface CSSProperties extends BaseCSSProperties, AtRuleCSSProperties, PseudoCSSProperties {
  [key: `& ${string}`]: CSSProperties;
  /** alias to `:nth-child(even)`. */
  ":even"?: BaseCSSProperties;
  /** alias to `:nth-child(odd)`. */
  ":odd"?: BaseCSSProperties;
  /** Mono page in.  */
  ":in"?: BaseCSSProperties & TransitionProps;
  /** Mono page out.  */
  ":out"?: BaseCSSProperties & TransitionProps;
}

export interface Attributes {
  key?: string | number;
  slot?: string;
  route?: `/${string}`;
}

export interface AsyncComponentAttributes {
  eager?: boolean;
  pending?: JSX.Element;
  catch?: (err: any) => JSX.Element;
}

export interface Elements {
  cache:
    & Attributes
    & AsyncComponentAttributes
    & {
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
  namespace JSX {
    interface CustomCSSRules {}
  }
}
