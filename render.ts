import type { Children, ChildType, VNode } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";
import { $computed, $fragment, $html, $state, $vnode } from "./symbols.ts";
import { createState } from "./state.ts";
import { RUNTIME_COMPONENTS_JS, RUNTIME_STATE_JS, RUNTIME_SUSPENSE_JS } from "./runtime/index.ts";
import { cx, escapeCSSText, escapeHTML, isObject, isString, styleToCSS, toHyphenCase } from "./runtime/utils.ts";

interface RenderContext {
  write: (chunk: string) => void;
  stateStore: Map<string, unknown>;
  suspenses: Promise<void>[];
  index: { fc: number; mf: number };
  rtComponents: { cx: boolean; styleToCSS: boolean };
  context?: Record<string, unknown>;
  request?: Request;
  eager?: boolean;
  slots?: Children;
  styleIds?: Set<string>;
}

const encoder = new TextEncoder();
const regexpHtmlTag = /^[a-z][\w\-$]*$/;
const selfClosingTags = new Set("area,base,br,col,embed,hr,img,input,keygen,link,meta,param,source,track,wbr".split(","));

const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
const toAttrStringLit = (str: string) => '"' + escapeHTML(str).replaceAll('"', '\\"') + '"';

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

        const fcIndex = ctx.index.fc.toString(36);

        // state
        if (tag === $state) {
          const { key, value } = props;
          write('<m-state fc="' + fcIndex + '" key=' + toAttrStringLit(key) + ">");
          if (value !== undefined && value !== null) {
            write(escapeHTML("" + value));
          }
          write("</m-state>");
          stateStore.set(fcIndex + ":" + key, value);
          break;
        }

        // computed
        if (tag === $computed) {
          const { deps, value, fn } = props;
          write(
            '<m-state fc="' + fcIndex + '" computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps))
              + ")</script>",
          );
          if (value !== undefined) {
            write(escapeHTML("" + value));
          }
          write("</m-state>");
          for (const [key, value] of Object.entries(deps)) {
            const stateKey = fcIndex + ":" + key;
            if (!stateStore.has(stateKey)) {
              stateStore.set(stateKey, value);
            }
          }
          break;
        }

        // toggle element
        if (tag === "toggle") {
          if (children !== undefined) {
            const valueProp = props.value;
            if (isVNode(valueProp) && valueProp[0] === $state || valueProp[0] === $computed) {
              const { key, deps, value, fn } = valueProp[1];
              write('<m-state mode="toggle" fc="' + fcIndex + '" ');
              if (key) {
                write("key=" + toAttrStringLit(key) + ">");
                stateStore.set(fcIndex + ":" + key, !!value);
              } else {
                write('computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps)) + ")</script>");
                for (const [key, value] of Object.entries(deps)) {
                  const stateKey = fcIndex + ":" + key;
                  if (!stateStore.has(stateKey)) {
                    stateStore.set(stateKey, value);
                  }
                }
              }
              if (!value) {
                write("<template m-slot>");
              }
              await renderChildren(ctx, children);
              if (!value) {
                write("</template>");
              }
              write("</m-state>");
            } else if (valueProp) {
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
              valueOrDefault = value ?? defaultValue;
              stateful = '<m-state mode="switch" fc="' + fcIndex + '" ';
              if (key) {
                stateful += "key=" + toAttrStringLit(key) + ">";
                stateStore.set(fcIndex + ":" + key, valueOrDefault);
              } else {
                stateful += 'computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps)) + ")</script>";
                for (const [key, value] of Object.entries(deps)) {
                  const stateKey = fcIndex + ":" + key;
                  if (!stateStore.has(stateKey)) {
                    stateStore.set(stateKey, value);
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
            const v = tag.call(createState(ctx.context, ctx.request), fcProps);
            ctx.index.fc++;
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
            if (err instanceof Error) {
              if (typeof catchFC === "function") {
                await renderNode({ ...ctx, eager: true }, catchFC(err));
              } else {
                write('<pre style="color:red;font-size:1rem"><code>' + escapeHTML(err.stack ?? err.message) + "</code></pre>");
              }
            }
          }
          break;
        }

        // regular html element
        if (isString(tag) && regexpHtmlTag.test(tag)) {
          let buffer = "<" + tag;
          let propEffects: string[] = [];
          let onMountHandler: (() => void) | undefined;
          for (let [propName, propValue] of Object.entries(props)) {
            if (propName === "children") {
              continue;
            }
            if (isVNode(propValue) && (propValue[0] === $state || propValue[0] === $computed)) {
              const { key, deps, fn, value } = propValue[1];
              if (propName === "class") {
                ctx.rtComponents.cx = true;
              } else if (propName === "style") {
                ctx.rtComponents.styleToCSS = true;
              }
              propEffects.push("<m-state mode=" + toAttrStringLit("[" + propName + "]") + ' fc="' + fcIndex + '" ');
              if (key) {
                propEffects.push("key=" + toAttrStringLit(key) + ">");
                stateStore.set(fcIndex + ":" + key, value);
              } else {
                propEffects.push('computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps)) + ")</script>");
                for (const [key, value] of Object.entries(deps)) {
                  const stateKey = fcIndex + ":" + key;
                  if (!stateStore.has(stateKey)) {
                    stateStore.set(stateKey, value);
                  }
                }
              }
              propEffects.push("</m-state>");
              propValue = value;
            }
            switch (propName) {
              case "class":
                buffer += " class=" + toAttrStringLit(cx(propValue));
                break;
              case "style":
                if (isString(propValue) && propValue !== "") {
                  buffer += ' style="' + escapeCSSText(propValue) + '"';
                } else if (isObject(propValue) && !Array.isArray(propValue)) {
                  const style: [string, string | number][] = [];
                  const pseudoStyles: [string, string][] = [];
                  const atRuleStyles: [string, string][] = [];
                  const nestingStyles: [string, string][] = [];
                  for (const [k, v] of Object.entries(propValue)) {
                    switch (k.charCodeAt(0)) {
                      case /* ':' */ 58:
                        pseudoStyles.push([escapeCSSText(k), styleToCSS(v)]);
                        break;
                      case /* '@' */ 64:
                        atRuleStyles.push([escapeCSSText(k), styleToCSS(v)]);
                        break;
                      case /* '&' */ 38:
                        nestingStyles.push([escapeCSSText(k), styleToCSS(v)]);
                        break;
                      default:
                        style.push([k, v]);
                    }
                  }
                  if (pseudoStyles.length > 0 || atRuleStyles.length > 0 || nestingStyles.length > 0) {
                    let css = "";
                    let raw = "";
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
                      for (const [p, styles] of pseudoStyles) {
                        css += cssSelector + p + "{" + styles + "}";
                      }
                      for (const [at, styles] of atRuleStyles) {
                        css += at + "{" + cssSelector + "{" + styles + "}}";
                      }
                      for (const [n, styles] of nestingStyles) {
                        css += cssSelector + n.slice(1) + "{" + styles + "}";
                      }
                      write('<style id="css-' + id + '">' + css + "</style>");
                    }
                    buffer += " data-css-" + id;
                  } else if (style.length > 0) {
                    buffer += ' style="' + styleToCSS(style) + '"';
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
                  const id = "$MF_" + (ctx.index.mf++).toString(36);
                  write("<script>function " + id + "(fd){(" + propValue.toString() + ")(fd)}</script>");
                  buffer += ' onsubmit="$onsubmit(event,this,' + id + ",'" + fcIndex + "')\"";
                } else if (isString(propValue)) {
                  buffer += " action=" + toAttrStringLit(propValue);
                }
                break;
              case "slot":
                if (!stripSlotProp && isString(propValue)) {
                  buffer += " slot=" + toAttrStringLit(propValue);
                }
                break;
              default:
                if (regexpHtmlTag.test(propName) && propValue !== undefined) {
                  if (propName.startsWith("on")) {
                    if (typeof propValue === "function") {
                      const id = "$MF_" + (ctx.index.mf++).toString(36);
                      write("<script>function " + id + "(e){(" + propValue.toString() + ")(e)}</script>");
                      buffer += " " + propName.toLowerCase() + '="$emit(event,this,' + id + ",'" + fcIndex + "')\"";
                    }
                  } else if (typeof propValue === "boolean") {
                    if (propValue) {
                      buffer += " " + propName;
                    }
                  } else {
                    buffer += " "
                      + (propValue === true ? escapeHTML(propName) : escapeHTML(propName) + "=" + toAttrStringLit("" + propValue));
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
            ctx.index.mf++;
            write(
              '<script>{const target=document.currentScript.previousElementSibling;addEventListener("load",()=>$emit({type:"mount",currentTarget:target,target},target,'
                + onMountHandler.toString()
                + ',"' + fcIndex + '"))}</script>',
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

/** Renders a VNode to a `Response` object. */
export function render(node: VNode, renderOptions: RenderOptions = {}): Response {
  const { context, request, status, headers: headersInit, rendering } = renderOptions;
  const headers = new Headers();
  if (headersInit) {
    for (const [key, value] of Object.entries(headersInit)) {
      if (value) {
        headers.set(toHyphenCase(key), value);
      }
    }
    const etag = headers.get("etag");
    if (etag && request?.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304 });
    }
    const lastModified = headers.get("last-modified");
    if (lastModified && request?.headers.get("if-modified-since") === lastModified) {
      return new Response(null, { status: 304 });
    }
  }
  headers.set("transfer-encoding", "chunked");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
        const stateStore = new Map<string, unknown>();
        const suspenses: Promise<void>[] = [];
        const rtComponents = { cx: false, styleToCSS: false };
        const ctx: RenderContext = {
          write,
          context,
          request,
          stateStore,
          suspenses,
          rtComponents,
          index: { fc: 0, mf: 0 },
          eager: rendering === "eager",
        };
        try {
          write("<!DOCTYPE html>");
          await renderNode(ctx, node);
          let js = "";
          if (stateStore.size > 0) {
            if (rtComponents.cx) {
              js += RUNTIME_COMPONENTS_JS.cx;
            }
            if (rtComponents.styleToCSS) {
              js += RUNTIME_COMPONENTS_JS.styleToCSS;
            }
            js += RUNTIME_STATE_JS;
            js += "for(let[k,v]of"
              + JSON.stringify(Array.from(stateStore.entries()).map((e) => e[1] === undefined ? [e[0]] : e))
              + ")$defineState(k,v);";
          }
          if (ctx.index.mf > 0) {
            js += RUNTIME_COMPONENTS_JS.event;
          }
          if (suspenses.length > 0) {
            js += RUNTIME_SUSPENSE_JS;
          }
          if (js) {
            write("<script>(()=>{" + js + "})()</script>");
          }
          if (suspenses.length > 0) {
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
