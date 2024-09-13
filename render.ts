import type { Children, ChildType, VNode } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";
import { RUNTIME_STATE, RUNTIME_SUSPENSE } from "./runtime/index.ts";
import { $computed, $fragment, $html, $state, $vnode } from "./jsx.ts";

interface RenderContext {
  write(chunk: string): void;
  store: Map<string, unknown>;
  suspenses: Promise<void>[];
  eventHandlerIndex: number;
  eager?: boolean;
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
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex-group",
  "box-flex",
  "box-ordinal-group",
  "column-count",
  "fill-opacity",
  "flex-grow",
  "flex-negative",
  "flex-order",
  "flex-positive",
  "flex-shrink",
  "flex",
  "flood-opacity",
  "font-weight",
  "grid-column",
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
const stringify = JSON.stringify;
const encoder = new TextEncoder();
const isObject = (v: unknown): v is object => typeof v === "object" && v !== null;
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const toAttrStringLit = (str: string) => stringify(escapeHTML(str));
const toHyphenCase = (k: string) => k.replace(/[a-z][A-Z]/g, (m) => m.charAt(0) + "-" + m.charAt(1).toLowerCase());

async function renderNode(ctx: RenderContext, node: ChildType | ChildType[], ignoreSlotProp?: boolean): Promise<void> {
  const { write, store } = ctx;
  switch (typeof node) {
    case "string":
      write(escapeHTML(node));
      break;
    case "number":
    case "bigint":
      write(node.toString());
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
          write("<mono-state key=" + toAttrStringLit(key) + " hidden></mono-state>");
          if (value !== undefined) {
            write(escapeHTML(String(value)));
          }
          write("<!--/-->");
          store.set(key, value);
          break;
        }

        // computed
        if (tag === $computed) {
          const { deps, value, fn } = props;
          write("<mono-computed deps=" + toAttrStringLit(deps.join(",")) + " hidden><template>" + fn + "</template></mono-computed>");
          if (value !== undefined) {
            write(escapeHTML(String(value)));
          }
          for (const dep of deps) {
            if (!store.has(dep)) {
              store.set(dep, undefined);
            }
          }
          write("<!--/-->");
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
                "<mono-toggle "
                  + (key ? "key=" + toAttrStringLit(key) : "deps=" + toAttrStringLit(deps.join(",")))
                  + " hidden>"
                  + (fn ? "<template>" + fn + "</template>" : "")
                  + "</mono-toggle><template"
                  + (valueOrDefault ? " leading></template>" : ">"),
              );
              await renderChildren(ctx, children);
              write(valueOrDefault ? "<!--/-->" : "</template>");
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
            const valueProp = props.value;
            const defaultValue = props.defaultValue;
            let name: string | undefined;
            let valueOrDefault: unknown;
            if (isVNode(valueProp) && valueProp[0] === $state || valueProp[0] === $computed) {
              const { key, deps, value, fn } = valueProp[1];
              name = key;
              valueOrDefault = value ?? defaultValue;
              write(
                "<mono-switch "
                  + (key ? "key=" + toAttrStringLit(key) : "deps=" + toAttrStringLit(deps.join(",")))
                  + " hidden>"
                  + (fn ? "<template>" + fn + "</template>" : "")
                  + "</mono-switch>",
              );
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
            const nodes = Array.isArray(children) ? (isVNode(children) ? [children] : children.filter(isVNode)) : [];
            let matchedIndex = -1;
            let defaultNode: VNode | undefined;
            for (let idx = 0; idx < nodes.length; idx++) {
              const childNode = nodes[idx];
              const childNodeProps = childNode[1];
              if (childNodeProps.default) {
                defaultNode = childNode;
                continue;
              }
              const key = childNodeProps.key;
              const matched = (key ?? idx) === valueOrDefault;
              if (matched) {
                matchedIndex = idx;
              }
              if (name) {
                write(
                  "<template"
                    + (key !== undefined ? " key=" + toAttrStringLit(String(key)) : "")
                    + (matched ? " leading></template>" : ">"),
                );
                await renderNode(ctx, childNode);
                if (matched) {
                  write("<!--/-->");
                } else {
                  write("</template>");
                }
              } else if (matched) {
                await renderNode(ctx, childNode);
              }
            }
            if (name && defaultNode) {
              write("<template default" + (matchedIndex === -1 ? " leading></template>" : ">"));
              await renderNode(ctx, defaultNode);
              if (matchedIndex === -1) {
                write("<!--/-->");
              } else {
                write("</template>");
              }
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
          try {
            const v = tag(fcProps);
            if (v instanceof Promise) {
              if (eager) {
                await renderNode({ ...ctx, eager: true, slots: children }, await v);
              } else {
                const chunkId = (ctx.suspenses.length + 1).toString(36);
                ctx.suspenses.push(v.then(async (c) => {
                  write('<suspense-chunk chunk-id="' + chunkId + '" hidden>');
                  await renderNode({ ...ctx, eager, slots: children }, c);
                  write("</suspense-chunk>");
                }));
                write('<suspense-slot chunk-id="' + chunkId + '"' + (placeholder ? " with-placeholder" : "") + " hidden></suspense-slot>");
                if (placeholder) {
                  await renderNode({ ...ctx, eager: true }, placeholder);
                  write("<!--/-->");
                }
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
        if (typeof tag === "string" && htmlTagRegexp.test(tag)) {
          if (tag.startsWith("icon-")) {
            const JSX = Reflect.get(globalThis, "JSX");
            const svg = JSX?.iconsRegistry.get(tag.slice(5));
            if (svg) {
              write(svg);
              break;
            }
          }
          let buffer = "<" + tag;
          let classAttrPosEnd = -1;
          let onMountHandler: (() => void) | undefined;
          let extraClass: string | undefined;
          for (const [key, value] of Object.entries(props)) {
            switch (key) {
              case "children":
              case "key":
              case "default":
                // skip
                break;
              case "class":
                buffer += " " + jsxAttr(key, cx(value) + (extraClass ? " " + extraClass : ""));
                classAttrPosEnd = buffer.length - 1;
                if (extraClass) {
                  extraClass = undefined;
                }
                break;
              case "style":
                if (typeof value === "string" && value !== "") {
                  buffer += " " + jsxAttr(key, cx(value));
                } else if (isObject(value) && !Array.isArray(value)) {
                  const style: [string, string | number][] = [];
                  const pseudoStyles: [string, string][] = [];
                  const atRuleStyles: [string, string][] = [];
                  const nestingStyles: [string, string][] = [];
                  for (const [k, v] of Object.entries(value)) {
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
                    let className: string;
                    if (style.length > 0) {
                      css = styleToCSS(style);
                      raw += css + "|";
                    }
                    raw += [pseudoStyles, atRuleStyles, nestingStyles].flat(1).map(([k, v]) => k + ">" + v).join("|");
                    styleIds = ctx.styleIds ?? (ctx.styleIds = new Set());
                    id = hashCode(raw).toString(36);
                    className = "css-" + id;
                    if (classAttrPosEnd > -1) {
                      buffer = buffer.slice(0, classAttrPosEnd) + " " + className + buffer.slice(classAttrPosEnd);
                    } else {
                      extraClass = className;
                    }
                    if (!styleIds.has(id)) {
                      styleIds.add(id);
                      if (css) {
                        css = "." + className + "{" + css + "}";
                      }
                      for (item of pseudoStyles) {
                        css += "." + className + item[0] + "{" + item[1] + "}";
                      }
                      for (item of atRuleStyles) {
                        css += item[0] + "{." + className + "{" + item[1] + "}}";
                      }
                      for (item of nestingStyles) {
                        css += "." + className + item[0].slice(1) + "{" + item[1] + "}";
                      }
                      write('<style id="' + className + '">' + css + "</style>");
                    }
                  } else if (style.length > 0) {
                    buffer += " " + jsxAttr(key, styleToCSS(style));
                  }
                }
                break;
              case "onMount":
                if (typeof value === "function") {
                  onMountHandler = value;
                }
                break;
              case "slot":
                if (!ignoreSlotProp && typeof value === "string") {
                  buffer += " " + jsxAttr(key, value);
                }
                break;
              default:
                if (htmlTagRegexp.test(key) && value !== undefined) {
                  if (key.startsWith("on")) {
                    if (typeof value === "function") {
                      const i = ctx.eventHandlerIndex++;
                      write("<script>var _EH$" + i + "=" + value.toString() + "</script>");
                      buffer += " " + jsxAttr(key.toLowerCase(), "_EH$" + i + ".call(this,event)");
                    }
                  } else if (typeof value === "boolean") {
                    if (value) {
                      buffer += " " + key;
                    }
                  } else {
                    buffer += " " + jsxAttr(key, value);
                  }
                }
            }
          }
          if (extraClass) {
            buffer += " " + jsxAttr("class", extraClass);
          }
          write(buffer + ">");
          if (!selfClosingTags.has(tag)) {
            if (props.innerHTML) {
              write(props.innerHTML);
            } else if (children !== undefined) {
              await renderChildren(ctx, children);
            }
            write("</" + (tag as string) + ">");
          }
          if (onMountHandler) {
            write("<script>(");
            write(onMountHandler.toString());
            write(')({type:"mount",target:document.currentScript.previousElementSibling})</script>');
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

async function renderChildren(ctx: RenderContext, children: Children, ignoreSlotProp?: boolean) {
  if (Array.isArray(children) && !isVNode(children)) {
    for (const child of children) {
      await renderNode(ctx, child, ignoreSlotProp);
    }
  } else {
    await renderNode(ctx, children, ignoreSlotProp);
  }
}

/** merge class names. */
function cx(className: unknown): string {
  if (typeof className === "string") {
    return className;
  }
  if (isObject(className)) {
    if (Array.isArray(className)) {
      return className.map(cx).filter(Boolean).join(" ");
    }
    const classNames = new Set();
    for (const [key, value] of Object.entries(className)) {
      if (value) {
        classNames.add(key);
      }
    }
    return Array.from(classNames).filter(Boolean).join(" ");
  }
  return "";
}

/** converts style object to css string. */
function styleToCSS(style: unknown): string {
  if (typeof style === "string") return style;
  if (!isObject(style)) return "";
  return (Array.isArray(style) ? style : Object.entries(style))
    .map(([k, v]) => {
      if (v === null || v === undefined || v === false || Number.isNaN(v) || typeof k !== "string") return "";
      const cssKey = toHyphenCase(k);
      const cssValue = typeof v === "number" ? cssBareUnitProps.has(cssKey) ? v.toString() : v + "px" : String(v);
      return cssKey + ":" + (cssKey === "content" ? toAttrStringLit(cssValue) : cssValue);
    })
    .join(";");
}

/** Hash code for strings */
function hashCode(s: string) {
  return [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
}

/** Converts a key-value pair to an attribute string. */
export function jsxAttr(key: string, value: unknown): string {
  if (value === true) return key;
  return key + "=" + toAttrStringLit(String(value));
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
export function escapeHTML(str: string): string {
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
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const store = new Map<string, unknown>();
      const suspenses: Promise<void>[] = [];
      const ctx: RenderContext = { write, store, suspenses, eventHandlerIndex: 0, eager: renderOptions?.rendering === "eager" };
      try {
        write("<!DOCTYPE html>");
        await renderNode(ctx, node);
        if (store.size > 0) {
          write("<script>(()=>{");
          write(RUNTIME_STATE);
          write("for(const[n,v]of");
          write(stringify(Array.from(store.entries()).map((e) => e[1] === undefined ? [e[0]] : e)));
          write(")createState(n,v);})()</script>");
        }
        if (suspenses.length > 0) {
          write("<script>(()=>{");
          write(RUNTIME_SUSPENSE);
          write("})()</script>");
          await Promise.all(suspenses);
        }
      } finally {
        controller.close();
      }
    },
  });
  const headers: Record<string, string> = Object.create(null);
  const request = renderOptions?.request;
  const headersInit = renderOptions?.headers;
  if (headersInit) {
    const { etag, lastModified } = headersInit;
    if (etag && request?.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304 });
    }
    if (lastModified && request?.headers.get("if-modified-since") === lastModified) {
      return new Response(null, { status: 304 });
    }
    for (const [key, value] of Object.entries(headersInit)) {
      if (value) {
        headers[toHyphenCase(key)] = value;
      }
    }
  }
  headers["transfer-encoding"] = "chunked";
  headers["content-type"] = "text/html; charset=utf-8";
  return new Response(readable, { headers });
}
