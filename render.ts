import type { ChildType, VNode } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";
import { createState } from "./state.ts";
import { $computed, $fragment, $html, $state, $vnode } from "./symbols.ts";
import { RUNTIME_COMPONENTS_JS, RUNTIME_STATE_JS, RUNTIME_SUSPENSE_JS } from "./runtime/index.ts";
import { cx, escapeCSSText, escapeHTML, isObject, isString, styleToCSS, toHyphenCase } from "./runtime/utils.ts";

interface RenderContext {
  write: (chunk: string) => void;
  appState: Record<string, unknown>;
  stateStore: Map<string, unknown>;
  suspenses: Promise<void>[];
  index: { fc: number; mf: number };
  rtComponents: { cx: boolean; styleToCSS: boolean };
  context?: Record<string, unknown>;
  request?: Request;
  eager?: boolean;
  fcIndex?: number;
  fcSlots?: ChildType[];
  styleIds?: Set<string>;
}

const encoder = new TextEncoder();
const regexpHtmlTag = /^[a-z][\w\-$]*$/;
const selfClosingTags = new Set("area,base,br,col,embed,hr,img,input,keygen,link,meta,param,source,track,wbr".split(","));

const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
const toAttrStringLit = (str: string) => '"' + escapeHTML(str) + '"';

async function renderNode(rc: RenderContext, node: ChildType, stripSlotProp?: boolean): Promise<void> {
  const { write } = rc;
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
        const [tag, props] = node;
        const { stateStore } = rc;

        // fragment element
        if (tag === $fragment) {
          if (props.children !== undefined) {
            await renderChildren(rc, props.children);
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

        // state
        if (tag === $state) {
          const { key, value, fc } = props;
          write('<m-state fc="' + fc + '" key=' + toAttrStringLit(key) + ">");
          if (value !== undefined && value !== null) {
            write(escapeHTML("" + value));
          }
          write("</m-state>");
          stateStore.set(fc + ":" + key, value);
          break;
        }

        // computed
        if (tag === $computed) {
          const { deps, value, fn, fc } = props;
          write(
            '<m-state fc="' + fc + '" computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps)) +
              ")</script>",
          );
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

        // `<slot>` element
        if (tag === "slot") {
          const { fcSlots } = rc;
          if (fcSlots) {
            let slots: ChildType[];
            if (props.name) {
              slots = fcSlots.filter((v) => isVNode(v) && v[1].slot === props.name);
            } else {
              slots = fcSlots.filter((v) => !isVNode(v) || !v[1].slot);
            }
            // use the children of the slot as fallback if nothing is slotted
            if (slots.length === 0) {
              slots = props.children;
            }
            await renderChildren(rc, slots, true);
          }
          break;
        }

        // toggle element
        if (tag === "toggle") {
          const { value: valueProp, children } = props;
          if (children !== undefined) {
            if (isVNode(valueProp) && valueProp[0] === $state || valueProp[0] === $computed) {
              const { key, deps, value, fn, fc } = valueProp[1];
              write('<m-state mode="toggle" fc="' + fc + '" ');
              if (key) {
                write("key=" + toAttrStringLit(key) + ">");
                stateStore.set(fc + ":" + key, !!value);
              } else {
                write('computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps)) + ")</script>");
                for (const [key, value] of Object.entries(deps)) {
                  if (!stateStore.has(key)) {
                    stateStore.set(key, value);
                  }
                }
              }
              if (!value) {
                write("<template m-slot>");
              }
              await renderChildren(rc, children);
              if (!value) {
                write("</template>");
              }
              write("</m-state>");
            } else if (valueProp) {
              await renderChildren(rc, children);
            }
          }
          break;
        }

        // switch element
        if (tag === "switch") {
          const { value: valueProp, defaultValue, children } = props;
          if (children !== undefined) {
            let slots = Array.isArray(children) ? (isVNode(children) ? [children] : children) : [children];
            let stateful: string | undefined;
            let computed: string | undefined;
            let valueOrDefault: unknown;
            if (isVNode(valueProp) && (valueProp[0] === $state || valueProp[0] === $computed)) {
              const { key, deps, value, fn, fc } = valueProp[1];
              valueOrDefault = value ?? defaultValue;
              stateful = '<m-state mode="switch" fc="' + fc + '" ';
              if (key) {
                stateful += "key=" + toAttrStringLit(key) + ">";
                stateStore.set(fc + ":" + key, valueOrDefault);
              } else {
                stateful += 'computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps)) + ")</script>";
                for (const [key, value] of Object.entries(deps)) {
                  if (!stateStore.has(key)) {
                    stateStore.set(key, value);
                  }
                }
              }
            } else {
              valueOrDefault = valueProp ?? defaultValue;
            }
            let matchedSlot: [string, ChildType] | undefined;
            let namedSlots: ChildType[] = new Array(slots.length);
            let unnamedSlots: ChildType[] = new Array(slots.length);
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
              await renderNode(rc, matchedSlot[1], true);
            } else if (unnamedSlots.length > 0) {
              await renderChildren(rc, unnamedSlots);
            }
            if (stateful) {
              if (namedSlots.length > 0 || (matchedSlot && unnamedSlots.length > 0)) {
                write("<template m-slot>");
                await renderChildren(rc, namedSlots);
                if (matchedSlot && unnamedSlots.length > 0) {
                  await renderChildren(rc, unnamedSlots);
                }
                write("</template>");
              }
              write("</m-state>");
            }
          }
          break;
        }

        // function component
        if (typeof tag === "function") {
          const fcIndex = ++rc.index.fc;
          const { rendering, placeholder, catch: catchFC, ...fcProps } = props ?? Object.create(null);
          try {
            const v = tag.call(createState(fcIndex, rc.appState, rc.context, rc.request), fcProps);
            const { children } = fcProps;
            const fcSlots = children !== undefined
              ? (Array.isArray(children) ? (isVNode(children) ? [children] : children) : [children])
              : undefined;
            const eager = ((rendering ?? tag.rendering) === "eager") || rc.eager;
            if (v instanceof Promise) {
              if (eager) {
                await renderNode({ ...rc, fcIndex, eager: true, fcSlots }, await v);
              } else {
                const chunkId = (rc.suspenses.length + 1).toString(36);
                rc.suspenses.push(v.then(async (c) => {
                  write('<m-chunk chunk-id="' + chunkId + '"><template>');
                  await renderNode({ ...rc, fcIndex, eager, fcSlots }, c);
                  write("</template></m-chunk>");
                }));
                write('<m-portal chunk-id="' + chunkId + '">');
                if (placeholder) {
                  await renderNode({ ...rc, fcIndex, eager: true }, placeholder);
                }
                write("</m-portal>");
              }
            } else if (isObject(v) && Symbol.iterator in v && !isVNode(v)) {
              for (const c of v) {
                await renderNode({ ...rc, fcIndex, eager, fcSlots }, c);
              }
            } else if (isObject(v) && Symbol.asyncIterator in v) {
              if (eager) {
                for await (const c of v) {
                  await renderNode({ ...rc, fcIndex, eager: true, fcSlots }, c);
                }
              } else {
                // todo: implement suspense for async generator
              }
            } else {
              await renderNode({ ...rc, fcIndex, eager, fcSlots }, v);
            }
          } catch (err) {
            if (err instanceof Error) {
              if (typeof catchFC === "function") {
                await renderNode({ ...rc, fcIndex, eager: true }, catchFC(err));
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
              const { key, value, deps, fn, fc } = propValue[1];
              if (propName === "class") {
                rc.rtComponents.cx = true;
              } else if (propName === "style") {
                rc.rtComponents.styleToCSS = true;
              }
              propEffects.push("<m-state mode=" + toAttrStringLit("[" + propName + "]") + ' fc="' + fc + '" ');
              if (key) {
                propEffects.push("key=" + toAttrStringLit(key) + ">");
                stateStore.set(fc + ":" + key, value);
              } else {
                propEffects.push('computed><script type="computed">$(' + fn + ", " + JSON.stringify(Object.keys(deps)) + ")</script>");
                for (const [key, value] of Object.entries(deps)) {
                  if (!stateStore.has(key)) {
                    stateStore.set(key, value);
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
                    styleIds = rc.styleIds ?? (rc.styleIds = new Set());
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
                  const fn = "$MF_" + (rc.index.mf++).toString(36);
                  write("<script>function " + fn + "(fd){(" + propValue.toString() + ")(fd)}</script>");
                  buffer += ' onsubmit="$onsubmit(event,this,' + fn + (rc.fcIndex !== undefined ? "," + rc.fcIndex : "") + ')"';
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
                      const fn = "$MF_" + (rc.index.mf++).toString(36);
                      write("<script>function " + fn + "(e){(" + propValue.toString() + ")(e)}</script>");
                      buffer += " " + propName.toLowerCase() + '="$emit(event,this,' +
                        fn +
                        (rc.fcIndex !== undefined ? "," + rc.fcIndex : "") +
                        ')"';
                    }
                  } else if (typeof propValue === "boolean") {
                    if (propValue) {
                      buffer += " " + propName;
                    }
                  } else {
                    buffer += " " + escapeHTML(propName) + (propValue === true ? "" : "=" + toAttrStringLit("" + propValue));
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
            } else if (props.children !== undefined) {
              await renderChildren(rc, props.children);
            }
            write("</" + tag + ">");
          } else if (propEffects.length > 0) {
            write("<m-group>" + propEffects.join("") + "</m-group>");
          }
          if (onMountHandler) {
            rc.index.mf++;
            write(
              '<script>{const target=document.currentScript.previousElementSibling;addEventListener("load",()=>$emit({type:"mount",currentTarget:target,target},target,' +
                onMountHandler.toString() +
                (rc.fcIndex !== undefined ? "," + rc.fcIndex : "") +
                "))}</script>",
            );
          }
        }
      }
      break;
  }
}

async function renderChildren(rc: RenderContext, children: ChildType | ChildType[], stripSlotProp?: boolean) {
  if (Array.isArray(children) && !isVNode(children)) {
    for (const child of children) {
      await renderNode(rc, child, stripSlotProp);
    }
  } else {
    await renderNode(rc, children, stripSlotProp);
  }
}

/** Renders a VNode to a `Response` object. */
export function render(node: VNode, renderOptions: RenderOptions = {}): Response {
  const { request, status, headers: headersInit } = renderOptions;
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
        const { appState: appStateInit, context, rendering } = renderOptions;
        const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
        const appState = createState(0, null, context, request);
        const stateStore = new Map<string, unknown>();
        const suspenses: Promise<void>[] = [];
        const rtComponents = { cx: false, styleToCSS: false };
        const rc: RenderContext = {
          write,
          context,
          request,
          appState,
          stateStore,
          suspenses,
          rtComponents,
          index: { fc: 0, mf: 0 },
          eager: rendering === "eager",
        };
        if (appStateInit) {
          for (const [key, value] of Object.entries(appStateInit)) {
            if (value !== undefined) {
              appState[key] = value;
            }
          }
        }
        try {
          write("<!DOCTYPE html>");
          await renderNode(rc, node);
          let js = "";
          if (rc.index.mf > 0) {
            js += RUNTIME_COMPONENTS_JS.event;
          }
          if (stateStore.size > 0) {
            if (rtComponents.cx) {
              js += RUNTIME_COMPONENTS_JS.cx;
            }
            if (rtComponents.styleToCSS) {
              js += RUNTIME_COMPONENTS_JS.styleToCSS;
            }
            js += RUNTIME_STATE_JS;
            js += "for(let[k,v]of" +
              JSON.stringify(Array.from(stateStore.entries()).map((e) => e[1] === undefined ? [e[0]] : e)) +
              ")$defineState(k,v);";
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
