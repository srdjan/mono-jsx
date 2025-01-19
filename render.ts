import type { Children, ChildType, VNode } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";
import { $computed, $context, $fragment, $html, $iconsRegistry, $state, $vnode } from "./symbols.ts";
import { RUNTIME_COMPONENTS_JS, RUNTIME_STATE_JS, RUNTIME_SUSPENSE_JS } from "./runtime/index.ts";
import { cx, isObject, isString, styleToCSS, toHyphenCase } from "./runtime/utils.ts";

interface RenderContext {
  write: (chunk: string) => void;
  stateStore: Map<string, unknown>;
  suspenses: Promise<void>[];
  evtHandlerIndex: number;
  rtComponents: { cx?: boolean; styleToCSS?: boolean };
  eager?: boolean;
  request?: Request;
  data?: Record<string, unknown>;
  slots?: Children;
  styleIds?: Set<string>;
}

const encoder = new TextEncoder();
const regexpHtmlTag = /^[a-z][\w\-$]*$/;
const regexpHtmlSafe = /["'&<>]/;
const selfClosingTags = new Set("area,base,br,col,embed,hr,img,input,keygen,link,meta,param,source,track,wbr".split(","));

const toAttrStringLit = (str: string) => JSON.stringify(escapeHTML(str));
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);

async function renderNode(ctx: RenderContext, node: ChildType | ChildType[], stripSlotProp?: boolean): Promise<void> {
  const { write, stateStore } = ctx;
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
          stateStore.set(key, value);
          break;
        }

        // computed
        if (tag === $computed) {
          const { deps, value, fn } = props;
          write('<m-state><script type="computed">$memo(' + fn + "," + JSON.stringify(Object.keys(deps)) + ")</script>");
          if (value !== undefined) {
            write(escapeHTML("" + value));
          }
          write("</m-state>");
          for (const [key, value] of Object.entries(deps)) {
            if (!stateStore.has(key)) {
              stateStore.set(key, value);
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
                  + (fn ? '<script type="computed">$memo(' + fn + "," + JSON.stringify(Object.keys(deps)) + ")</script>" : "")
                  + (!valueOrDefault ? "<template m-slot>" : ""),
              );
              await renderChildren(ctx, children);
              if (!valueOrDefault) {
                write("</template>");
              }
              write("</m-state>");
              if (key) {
                stateStore.set(key, valueOrDefault);
              } else {
                for (const [key, value] of Object.entries(deps)) {
                  if (!stateStore.has(key)) {
                    stateStore.set(key, value);
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
                stateStore.set(key, valueOrDefault);
              } else {
                for (const dep of deps) {
                  if (!stateStore.has(dep)) {
                    stateStore.set(dep, undefined);
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
          try {
            $context.request = ctx.request;
            $context.data = ctx.data;
            const v = tag(fcProps);
            delete $context.request;
            delete $context.data;
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
        if (isString(tag) && regexpHtmlTag.test(tag)) {
          if (tag.startsWith("icon-")) {
            const svg = $iconsRegistry.get(tag.slice(5));
            if (svg) {
              write(svg);
              break;
            }
          }
          let buffer = "<" + tag;
          let propEffects: string[] = [];
          let onMountHandler: (() => void) | undefined;
          for (let [propName, propValue] of Object.entries(props)) {
            if (propName === "children") {
              continue;
            }
            if (isVNode(propValue) && (propValue[0] === $state || propValue[0] === $computed)) {
              const { key, deps, fn } = propValue[1];
              if (propName === "class") {
                ctx.rtComponents.cx = true;
              } else if (propName === "style") {
                ctx.rtComponents.styleToCSS = true;
              }
              propEffects.push(
                "<m-state mode=" + toAttrStringLit("[" + propName + "]")
                  + (key ? " use=" + toAttrStringLit(key) : "")
                  + ">"
                  + (fn ? '<script type="computed">$memo(' + fn + "," + JSON.stringify(Object.keys(deps)) + ")</script>" : "")
                  + "</m-state>",
              );
              if (key) {
                ctx.stateStore.set(key, propValue[1].value);
              } else {
                for (const [key, value] of Object.entries(deps)) {
                  if (!stateStore.has(key)) {
                    stateStore.set(key, value);
                  }
                }
              }
              propValue = propValue[1].value;
            }
            switch (propName) {
              case "class":
                buffer += " " + renderAttr(propName, cx(propValue));
                break;
              case "style":
                if (isString(propValue) && propValue !== "") {
                  buffer += " " + renderAttr(propName, cx(propValue));
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
                    let styleIds: Set<string>;
                    let id: string;
                    let cssSelector: string;
                    let key: string;
                    let value: string;
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
                      for ([key, value] of pseudoStyles) {
                        css += cssSelector + key + "{" + value + "}";
                      }
                      for ([key, value] of atRuleStyles) {
                        css += key + "{" + cssSelector + "{" + value + "}}";
                      }
                      for ([key, value] of nestingStyles) {
                        css += cssSelector + key.slice(1) + "{" + value + "}";
                      }
                      write('<style id="css-' + id + '">' + css + "</style>");
                    }
                    buffer += " data-css-" + id;
                  } else if (style.length > 0) {
                    buffer += " " + renderAttr(propName, styleToCSS(style));
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
                  const id = "$mf_" + (ctx.evtHandlerIndex++).toString(36);
                  write("<script>var " + id + "=" + propValue.toString() + "</script>");
                  buffer += " " + renderAttr("onsubmit", "event.preventDefault();" + id + ".call(this,new FormData(this))");
                } else if (isString(propValue)) {
                  buffer += " " + renderAttr(propName, propValue);
                }
                break;
              case "slot":
                if (!stripSlotProp && isString(propValue)) {
                  buffer += " " + renderAttr(propName, propValue);
                }
                break;
              default:
                if (regexpHtmlTag.test(propName) && propValue !== undefined) {
                  if (propName.startsWith("on")) {
                    if (typeof propValue === "function") {
                      const id = "$mf_" + (ctx.evtHandlerIndex++).toString(36);
                      write("<script>var " + id + "=" + propValue.toString() + "</script>");
                      buffer += " " + renderAttr(propName.toLowerCase(), id + ".call(this,event)");
                    }
                  } else if (typeof propValue === "boolean") {
                    if (propValue) {
                      buffer += " " + propName;
                    }
                  } else {
                    buffer += " " + renderAttr(propName, propValue);
                  }
                }
            }
          }
          write(buffer + ">");
          if (!selfClosingTags.has(tag)) {
            if (propEffects.length > 0) {
              write(propEffects.join(""));
            }
            if (props.innerHTML) {
              write(props.innerHTML);
            } else if (children !== undefined) {
              await renderChildren(ctx, children);
            }
            write("</" + (tag as string) + ">");
          } else if (propEffects.length > 0) {
            write("<m-group>");
            write(propEffects.join(""));
            write("</m-group>");
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

function renderAttr(key: string, value: unknown): string {
  return value === true ? key : key + "=" + toAttrStringLit("" + value);
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
  const match = regexpHtmlSafe.exec(str);
  if (!match) {
    return str;
  }

  // @ts-ignore use bun's built-in `escapeHTML` function if available
  if (typeof Bun === "object" && "escapeHTML" in Bun) return Bun.escapeHTML(str);

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

/** Renders a VNode to a `Response` object. */
export function render(node: VNode, renderOptions: RenderOptions = {}): Response {
  const { request, status = 200, headers: headersRaw, rendering, data } = renderOptions;
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
        const stateStore = new Map<string, unknown>();
        const suspenses: Promise<void>[] = [];
        const rtComponents: { cx?: boolean; styleToCSS?: boolean } = {};
        const ctx: RenderContext = {
          request,
          data,
          write,
          stateStore,
          suspenses,
          rtComponents,
          evtHandlerIndex: 0,
          eager: rendering === "eager",
        };
        try {
          write("<!DOCTYPE html>");
          await renderNode(ctx, node);
          if (stateStore.size > 0) {
            write(
              "<script>(()=>{"
                + (rtComponents.cx ? RUNTIME_COMPONENTS_JS.cx : "")
                + (rtComponents.styleToCSS ? RUNTIME_COMPONENTS_JS.styleToCSS : "")
                + RUNTIME_STATE_JS
                + "for(let[n,v]of"
                + JSON.stringify(Array.from(stateStore.entries()).map((e) => e[1] === undefined ? [e[0]] : e))
                + ")defineState(n,v)"
                + "})()</script>",
            );
          }
          if (suspenses.length > 0) {
            write("<script>(()=>{" + RUNTIME_SUSPENSE_JS + "})()</script>");
            await Promise.all(suspenses);
          }
        } finally {
          controller.close();
        }
      },
    }),
    { headers, status },
  );
}
