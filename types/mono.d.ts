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

export type ChildType = JSX.Element | (JSX.Element | string | null)[] | string | number | bigint | boolean | null;

export interface BaseAttributes {
  children?: ChildType | ChildType[];
  key?: string | number;
  slot?: string;
}

export interface AsyncComponentAttributes {
  /**
   * Try to catch errors in the component.
   */
  catch?: (err: any) => JSX.Element;
  /**
   * The loading spinner for the async component.
   */
  placeholder?: JSX.Element;
  /**
   * Rendering mode
   * - `eager`: render async component eagerly
   */
  rendering?: "eager";
}

export interface Elements {
  /**
   * The `<toggle>` element is a custom element that represents a toggle switch.
   */
  toggle: BaseAttributes & {
    value?: boolean | string | number | null;
  };
  /**
   * The `<switch>` element is a custom element that represents a switch.
   */
  switch: BaseAttributes & {
    value?: string;
    defaultValue?: string;
  };
}

declare global {
  /**
   * The `html` function is used to create XSS-unsafe HTML elements.
   */
  var html: JSX.Raw, css: JSX.Raw, js: JSX.Raw;

  /**
   * mono-jsx `this` object that is bound to the function component.
   */
  type FC<State = {}, AppState = {}, Context = {}> = {
    /**
     * Application state.
     * This is the state that is shared across the entire application.
     */
    readonly app: AppState;
    /**
     * Context object.
     */
    readonly context: Context;
    /**
     * Current request object.
     */
    readonly request: Request;
    /**
     * The `computed` function is used to create a computed property.
     * It takes a function that returns a value and returns the value.
     */
    readonly computed: <V = unknown>(computeFn: () => V) => V;
  } & Omit<State, "app" | "context" | "request" | "computed">;
}
