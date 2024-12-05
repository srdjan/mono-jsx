import type { Children, ChildType, VNode } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";
import { $computed, $context, $fragment, $html, $iconsRegistry, $state, $vnode } from "./symbols.ts";
import { RUNTIME_STATE, RUNTIME_SUSPENSE } from "./runtime/index.ts";

interface RenderContext {
  write: (chunk: string) => void;
  store: Map<string, unknown>;
  suspenses: Promise<void>[];
  evtHandlerIndex: number;
  eager?: boolean;
  request?: Request;
  slots?: Children;
  styleIds?: Set<string>;
}

const selfClosingTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const cssBareUnitProps = new Set([
  "animation-iteration-count",
  "aspect-ratio",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex-group",
  "box-flex",
  "box-ordinal-group",
  "column-count",
  "columns",
  "fill-opacity",
  "flex-grow",
  "flex-negative",
  "flex-order",
  "flex-positive",
  "flex-shrink",
  "flex",
  "flood-opacity",
  "font-weight",
  "grid-area",
  "grid-column-end",
  "grid-column-span",
  "grid-column-start",
  "grid-column",
  "grid-row-end",
  "grid-row-span",
  "grid-row-start",
  "grid-row",
  "line-clamp",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
]);

const htmlTagRegexp = /^[a-z][\w\-$]*$/;
const matchHtmlRegExp = /["'&<>]/;
const encoder = new TextEncoder();
const isString = (v: unknown): v is string => typeof v === "string";
const isObject = (v: unknown): v is object => typeof v === "object" && v !== null;
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const toAttrStringLit = (str: string) => JSON.stringify(escapeHTML(str));
const toHyphenCase = (k: string) => k.replace(/[a-z][A-Z]/g, (m) => m.charAt(0) + "-" + m.charAt(1).toLowerCase());

async function renderNode(ctx: RenderContext, node: ChildType | ChildType[], stripSlotProp?: boolean): Promise<void> {
  const { write, store } = ctx;
  switch (typeof node) {
    case "string":
      write(escapeHTML(node));
      break;
    case "number":
    case "bigint":
      write("" + node);
      break;
    case "object":
      if (isVNode(node)) {
        let [tag, props] = node;
        let children: Children | undefined = props.children;

        // fragment element
        if (tag === $fragment) {
          if (children !== undefined) {
            await renderChildren(ctx, children);
          }
          break;
        }

        // XSS!
        if (tag === $html) {
          if (props.innerHTML) {
            write(props.innerHTML);
          }
          break;
        }

        // `<slot>` element
        if (tag === "slot") {
          const ctxSlots = ctx.slots;
          let slots: (ChildType | ChildType[])[] | undefined;
          if (ctxSlots !== undefined) {
            if (Array.isArray(ctxSlots)) {
              if (isVNode(ctxSlots)) {
                slots = [ctxSlots];
              } else {
                slots = ctxSlots;
              }
            } else {
              slots = [ctxSlots];
            }
          }
          if (props.name) {
            children = slots?.filter((v) => isVNode(v) && v[1].slot === props.name);
          } else {
            children = slots?.filter((v) => !isVNode(v) || !v[1].slot);
          }
          // use the children of the slot as fallback if nothing is slotted
          if (children === undefined || (Array(children) && children.length === 0)) {
            children = node[1].children;
          }
          if (children !== undefined) {
            await renderChildren(ctx, children, true);
          }
          break;
        }

        // state
        if (tag === $state) {
          const { key, value } = props;
          write("<m-state use=" + toAttrStringLit(key) + ">");
          if (value !== undefined && value !== null) {
            write(escapeHTML("" + value));
          }
          write("</m-state>");
          store.set(key, value);
          break;
        }

        // computed
        if (tag === $computed) {
          const { deps, value, fn } = props;
          write('<m-state><script type="computed">$memo(' + fn + "," + JSON.stringify(deps) + ")</script>");
          if (value !== undefined) {
            write(escapeHTML("" + value));
          }
          write("</m-state>");
          for (const dep of deps) {
            if (!store.has(dep)) {
              store.set(dep, undefined);
            }
          }
          break;
        }

        // toggle element
        if (tag === "toggle") {
          if (children !== undefined) {
            const valueProp = props.value;
            const defaultValue = props.defaultValue;
            if (isVNode(valueProp) && valueProp[0] === $state || valueProp[0] === $computed) {
              const { key, deps, value, fn } = valueProp[1];
              const valueOrDefault = value ?? defaultValue;
              write(
                '<m-state mode="toggle" ' + (key ? "use=" + toAttrStringLit(key) : "") + ">"
                  + (fn ? '<script type="computed">$memo(' + fn + "," + JSON.stringify(deps) + ")</script>" : "")
                  + (!valueOrDefault ? "<template m-slot>" : ""),
              );
              await renderChildren(ctx, children);
              if (!valueOrDefault) {
                write("</template>");
              }
              write("</m-state>");
              if (key) {
                store.set(key, valueOrDefault);
              } else {
                for (const dep of deps) {
                  if (!store.has(dep)) {
                    store.set(dep, undefined);
                  }
                }
              }
            } else if (valueProp ?? defaultValue) {
              await renderChildren(ctx, children);
            }
          }
          break;
        }

        // switch element
        if (tag === "switch") {
          if (children !== undefined) {
            let slots = Array.isArray(children) ? (isVNode(children) ? [children] : children) : [children];
            let valueProp = props.value;
            let defaultValue = props.defaultValue;
            let stateful: string | undefined;
            let computed: string | undefined;
            let valueOrDefault: unknown;
            if (isVNode(valueProp) && (valueProp[0] === $state || valueProp[0] === $computed)) {
              const { key, deps, value, fn } = valueProp[1];
              stateful = '<m-state mode="switch" ' + (key ? "use=" + toAttrStringLit(key) : "") + ">";
              if (fn) {
                computed = '<script type="computed">$memo(' + fn + "," + JSON.stringify(deps) + ")</script>";
              }
              valueOrDefault = value ?? defaultValue;
              if (key) {
                store.set(key, valueOrDefault);
              } else {
                for (const dep of deps) {
                  if (!store.has(dep)) {
                    store.set(dep, undefined);
                  }
                }
              }
            } else {
              valueOrDefault = valueProp ?? defaultValue;
            }
            let matchedSlot: [string, ChildType | ChildType[]] | undefined;
            let namedSlots: (ChildType | ChildType[])[] = new Array(slots.length);
            let unnamedSlots: (ChildType | ChildType[])[] = new Array(slots.length);
            for (const slot of slots) {
              if (!isVNode(slot) || !slot[1].slot) {
                unnamedSlots.push(slot);
                continue;
              }
              const slotName = slot[1].slot;
              if (slotName === valueOrDefault) {
                matchedSlot = [slotName, slot];
              } else {
                namedSlots.push(slot);
              }
            }
            if (stateful) {
              write(matchedSlot ? stateful.slice(0, -1) + " match=" + toAttrStringLit(matchedSlot[0]) + ">" : stateful);
              if (computed) {
                write(computed);
              }
            }
            if (matchedSlot) {
              await renderNode(ctx, matchedSlot[1], true);
            } else if (unnamedSlots.length > 0) {
              await renderChildren(ctx, unnamedSlots);
            }
            if (stateful) {
              if (namedSlots.length > 0 || (matchedSlot && unnamedSlots.length > 0)) {
                write("<template m-slot>");
                await renderChildren(ctx, namedSlots);
                if (matchedSlot && unnamedSlots.length > 0) {
                  await renderChildren(ctx, unnamedSlots);
                }
                write("</template>");
              }
              write("</m-state>");
            }
          }
          break;
        }

        // fc element
        if (typeof tag === "function") {
          const { rendering, placeholder, catch: catchFC, ...fcProps } = props ?? Object.create(null);
          let eager = ctx.eager;
          if ((rendering ?? tag.rendering) === "eager") {
            eager = true;
          }
          $context.req = ctx.request;
          try {
            const v = tag(fcProps);
            if (v instanceof Promise) {
              if (eager) {
                await renderNode({ ...ctx, eager: true, slots: children }, await v);
              } else {
                const chunkId = (ctx.suspenses.length + 1).toString(36);
                ctx.suspenses.push(v.then(async (c) => {
                  write('<m-chunk chunk-id="' + chunkId + '"><template>');
                  await renderNode({ ...ctx, eager, slots: children }, c);
                  write("</template></m-chunk>");
                }));
                write('<m-portal chunk-id="' + chunkId + '">');
                if (placeholder) {
                  await renderNode({ ...ctx, eager: true }, placeholder);
                }
                write("</m-portal>");
              }
            } else if (isObject(v) && Symbol.iterator in v && !isVNode(v)) {
              for (const c of v) {
                await renderNode({ ...ctx, eager, slots: children }, c);
              }
            } else if (isObject(v) && Symbol.asyncIterator in v) {
              if (eager) {
                for await (const c of v) {
                  await renderNode({ ...ctx, eager: true, slots: children }, c);
                }
              } else {
                // todo: implement suspense for async generator
              }
            } else {
              await renderNode({ ...ctx, eager, slots: children }, v);
            }
          } catch (err) {
            if (typeof catchFC === "function") {
              await renderNode({ ...ctx, eager: true }, catchFC(err));
            } else {
              write('<pre style="color:red;font-size:1rem"><code>' + escapeHTML(err.stack) + "</code></pre>");
            }
          }
          break;
        }

        // regular html element
        if (isString(tag) && htmlTagRegexp.test(tag)) {
          if (tag.startsWith("icon-")) {
            const svg = $iconsRegistry.get(tag.slice(5));
            if (svg) {
              write(svg);
              break;
            }
          }
          let buffer = "<" + tag;
          let modifiers: string[] = [];
          let onMountHandler: (() => void) | undefined;
          for (let [propName, propValue] of Object.entries(props)) {
            if (propName === "children") {
              continue;
            }
            if (isVNode(propValue) && (propValue[0] === $state || propValue[0] === $computed)) {
              const { key, deps, fn } = propValue[1];
              modifiers.push(
                "<m-state mode=" + toAttrStringLit("[" + propName + "]")
                  + (key ? " use=" + toAttrStringLit(key) : "")
                  + ">"
                  + (fn ? '<script type="computed">$memo(' + fn + "," + JSON.stringify(deps) + ")</script>" : "")
                  + "</m-state>",
              );
              if (key) {
                ctx.store.set(key, propValue[1].value);
              } else {
                for (const dep of deps) {
                  if (!store.has(dep)) {
                    store.set(dep, undefined);
                  }
                }
              }
              propValue = propValue[1].value;
            }
            switch (propName) {
              case "class":
                buffer += " " + jsxAttr(propName, cx(propValue));
                break;
              case "style":
                if (isString(propValue) && propValue !== "") {
                  buffer += " " + jsxAttr(propName, cx(propValue));
                } else if (isObject(propValue) && !Array.isArray(propValue)) {
                  const style: [string, string | number][] = [];
                  const pseudoStyles: [string, string][] = [];
                  const atRuleStyles: [string, string][] = [];
                  const nestingStyles: [string, string][] = [];
                  for (const [k, v] of Object.entries(propValue)) {
                    switch (k.charCodeAt(0)) {
                      case /* ':' */ 58:
                        pseudoStyles.push([k, styleToCSS(v)]);
                        break;
                      case /* '@' */ 64:
                        atRuleStyles.push([k, styleToCSS(v)]);
                        break;
                      case /* '&' */ 38:
                        nestingStyles.push([k, styleToCSS(v)]);
                        break;
                      default:
                        style.push([k, v]);
                    }
                  }
                  if (pseudoStyles.length > 0 || atRuleStyles.length > 0 || nestingStyles.length > 0) {
                    let raw = "";
                    let css = "";
                    let item: [string, string];
                    let styleIds: Set<string>;
                    let id: string;
                    let cssSelector: string;
                    if (style.length > 0) {
                      css = styleToCSS(style);
                      raw += css + "|";
                    }
                    raw += [pseudoStyles, atRuleStyles, nestingStyles].flat(1).map(([k, v]) => k + ">" + v).join("|");
                    styleIds = ctx.styleIds ?? (ctx.styleIds = new Set());
                    id = hashCode(raw).toString(36);
                    cssSelector = "[data-css-" + id + "]";
                    if (!styleIds.has(id)) {
                      styleIds.add(id);
                      if (css) {
                        css = cssSelector + "{" + css + "}";
                      }
                      for (item of pseudoStyles) {
                        css += cssSelector + item[0] + "{" + item[1] + "}";
                      }
                      for (item of atRuleStyles) {
                        css += item[0] + "{" + cssSelector + "{" + item[1] + "}}";
                      }
                      for (item of nestingStyles) {
                        css += cssSelector + item[0].slice(1) + "{" + item[1] + "}";
                      }
                      write('<style id="css-' + id + '">' + css + "</style>");
                    }
                    buffer += " data-css-" + id;
                  } else if (style.length > 0) {
                    buffer += " " + jsxAttr(propName, styleToCSS(style));
                  }
                }
                break;
              case "onMount":
                if (typeof propValue === "function") {
                  onMountHandler = propValue;
                }
                break;
              case "action":
                if (typeof propValue === "function" && tag === "form") {
                  const id = "_m_fn_" + (ctx.evtHandlerIndex++).toString(36);
                  write("<script>var " + id + "=" + propValue.toString() + "</script>");
                  buffer += " " + jsxAttr("onsubmit", "event.preventDefault();" + id + ".call(this,new FormData(this))");
                } else if (isString(propValue)) {
                  buffer += " " + jsxAttr(propName, propValue);
                }
                break;
              case "slot":
                if (!stripSlotProp && isString(propValue)) {
                  buffer += " " + jsxAttr(propName, propValue);
                }
                break;
              default:
                if (htmlTagRegexp.test(propName) && propValue !== undefined) {
                  if (propName.startsWith("on")) {
                    if (typeof propValue === "function") {
                      const id = "_m_fn_" + (ctx.evtHandlerIndex++).toString(36);
                      write("<script>var " + id + "=" + propValue.toString() + "</script>");
                      buffer += " " + jsxAttr(propName.toLowerCase(), id + ".call(this,event)");
                    }
                  } else if (typeof propValue === "boolean") {
                    if (propValue) {
                      buffer += " " + propName;
                    }
                  } else {
                    buffer += " " + jsxAttr(propName, propValue);
                  }
                }
            }
          }
          write(buffer + ">");
          if (modifiers.length > 0) {
            write(modifiers.join(""));
          }
          if (!selfClosingTags.has(tag)) {
            if (props.innerHTML) {
              write(props.innerHTML);
            } else if (children !== undefined) {
              await renderChildren(ctx, children);
            }
            write("</" + (tag as string) + ">");
          }
          if (onMountHandler) {
            write(
              "<script>{const target=document.currentScript.previousElementSibling;("
                + onMountHandler.toString()
                + ')({type:"mount",currentTarget:target,target})}</script>',
            );
          }
        }
      } else if (Array.isArray(node) || (node && Symbol.iterator in node)) {
        for (const child of node) {
          await renderNode(ctx, child);
        }
      }
      break;
  }
}

async function renderChildren(ctx: RenderContext, children: Children, stripSlotProp?: boolean) {
  if (Array.isArray(children) && !isVNode(children)) {
    for (const child of children) {
      await renderNode(ctx, child, stripSlotProp);
    }
  } else {
    await renderNode(ctx, children, stripSlotProp);
  }
}

/** merge class names. */
function cx(className: unknown): string {
  if (isString(className)) {
    return className;
  }
  if (isObject(className)) {
    if (Array.isArray(className)) {
      return className.map(cx).filter(Boolean).join(" ");
    }
    return Object.entries(className).filter(([, v]) => !!v).map(([k]) => k).join(" ");
  }
  return "";
}

/** converts style object to css string. */
function styleToCSS(style: unknown): string {
  if (isString(style)) return style;
  if (!isObject(style)) return "";
  let css = "";
  for (const [k, v] of Array.isArray(style) ? style : Object.entries(style)) {
    if (v === null || v === undefined || v === false || Number.isNaN(v) || !isString(k)) return "";
    const cssKey = toHyphenCase(k);
    const cssValue = typeof v === "number" ? cssBareUnitProps.has(cssKey) ? "" + v : v + "px" : "" + v;
    css += (css !== "" ? ";" : "") + cssKey + ":" + (cssKey === "content" ? toAttrStringLit(cssValue) : cssValue);
  }
  return css;
}

/** Hash code for strings */
function hashCode(s: string) {
  return [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
}

/** Converts a key-value pair to an attribute string. */
function jsxAttr(key: string, value: unknown): string {
  if (value === true) return key;
  return key + "=" + toAttrStringLit("" + value);
}

/**
 * Escapes special characters and HTML entities in a given html string.
 * Based on https://github.com/component/escape-html
 * Use `Bun.escapeHTML` preferentially if available.
 *
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT License
 */
function escapeHTML(str: string): string {
  const match = matchHtmlRegExp.exec(str);
  if (!match) {
    return str;
  }

  // @ts-ignore use bun's built-in `escapeHTML` function if available
  if (typeof Bun === "object" && Bun.escapeHTML) return Bun.escapeHTML(str);

  let escape: string;
  let index: number;
  let lastIndex = 0;
  let html = "";

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = "&quot;";
        break;
      case 38: // &
        escape = "&amp;";
        break;
      case 39: // '
        escape = "&#x27;"; // modified from escape-html; used to be '&#39'
        break;
      case 60: // <
        escape = "&lt;";
        break;
      case 62: // >
        escape = "&gt;";
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.slice(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + str.slice(lastIndex, index) : html;
}

export function render(node: VNode, renderOptions?: RenderOptions): Response {
  const request = renderOptions?.request;
  const headersRaw = renderOptions?.headers;
  const headers: Record<string, string> = Object.create(null);
  if (headersRaw) {
    const { etag, lastModified } = headersRaw;
    if (etag && request?.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304 });
    }
    if (lastModified && request?.headers.get("if-modified-since") === lastModified) {
      return new Response(null, { status: 304 });
    }
    for (const [key, value] of Object.entries(headersRaw)) {
      if (value) {
        headers[toHyphenCase(key)] = value;
      }
    }
  }
  headers["transfer-encoding"] = "chunked";
  headers["content-type"] = "text/html; charset=utf-8";
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
        const store = new Map<string, unknown>();
        const suspenses: Promise<void>[] = [];
        const ctx: RenderContext = {
          request,
          write,
          store,
          suspenses,
          evtHandlerIndex: 0,
          eager: renderOptions?.rendering === "eager",
        };
        try {
          write("<!DOCTYPE html>");
          await renderNode(ctx, node);
          if (store.size > 0) {
            write(
              "<script>(()=>{"
                + RUNTIME_STATE
                + "for(let[n,v]of"
                + JSON.stringify(Array.from(store.entries()).map((e) => e[1] === undefined ? [e[0]] : e))
                + ")defineState(n,v)})()</script>",
            );
          }
          if (suspenses.length > 0) {
            write("<script>(()=>{" + RUNTIME_SUSPENSE + "})()</script>");
            await Promise.all(suspenses);
          }
        } finally {
          controller.close();
        }
      },
    }),
    { headers },
  );
}
