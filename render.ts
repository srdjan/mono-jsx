import type { ChildType, VNode } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";
import { $computed, $fragment, $html, $state, $vnode } from "./symbols.ts";
import { STATE_JS, SUSPENSE_JS, UTILS_JS } from "./runtime/index.ts";
import { cx, escapeCSSText, escapeHTML, isObject, isString, styleToCSS, toHyphenCase } from "./runtime/utils.ts";

interface RenderContext {
  write: (chunk: string) => void;
  suspenses: Promise<string>[];
  mcs: IdGen<VNode>;
  mfs: IdGen<CallableFunction>;
  status: RenderStatus;
  appState: Record<string, unknown>;
  stateStore: Map<string, unknown>;
  context?: Record<string, unknown>;
  request?: Request;
  fcId?: number;
  fcSlots?: ChildType[];
  cssIds?: Set<string>;
}

interface RenderStatus {
  fcIndex: number;
  chunkIndex: number;
  onmount: number;
  cx?: boolean;
  styleToCSS?: boolean;
}

interface RuntimeJSMeta {
  state?: boolean;
  cx?: boolean;
  styleToCSS?: boolean;
  suspense?: boolean;
  event?: boolean;
}

interface IdGen<K> {
  readonly size: number;
  entries(): Iterable<[K, string]>;
  clear(): void;
  gen(key: K): string;
}

const encoder = new TextEncoder();
const regexpHtmlTag = /^[a-z][\w\-$]*$/;
const selfClosingTags = new Set("area,base,br,col,embed,hr,img,input,keygen,link,meta,param,source,track,wbr".split(","));
const cdn = "https://raw.esm.sh"; // the cdn for loading htmx and its extensions

const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
const toAttrStringLit = (str: string) => '"' + escapeHTML(str) + '"';
const str = <T = string | number>(v: T | undefined, str: (v: T) => string) => v !== undefined ? str(v) : "";

let collectDeps: ((fc: number, key: string, value: unknown) => void) | undefined;

function createThis(
  fc: number,
  appState: Record<string, unknown> | null,
  context?: Record<string, unknown>,
  request?: Request,
): Record<string, unknown> {
  const computed = (fn: () => unknown): unknown => {
    const deps = Object.create(null);
    collectDeps = (fc, key, value) => deps[fc + ":" + key] = value;
    const value = fn.call(thisProxy);
    collectDeps = undefined;
    if (value instanceof Promise || Object.keys(deps).length === 0) return value;
    return [$computed, { value, deps, fc, fn }, $vnode];
  };
  const thisProxy = new Proxy(Object.create(null), {
    get(target, key, receiver) {
      switch (key) {
        case "app":
          return appState;
        case "context":
          return context ?? {};
        case "request":
          if (!request) {
            throw new Error("request is not defined");
          }
          return request;
        case "computed":
          return computed;
        default: {
          const value = Reflect.get(target, key, receiver);
          if (typeof key === "symbol") {
            return value;
          }
          if (collectDeps) {
            collectDeps(fc, key, value);
            return value;
          }
          return [$state, { key, value, fc }, $vnode];
        }
      }
    },
    set(target, key, value, receiver) {
      return Reflect.set(target, key, value, receiver);
    },
  });
  return thisProxy;
}

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
          const { deps, value, fc } = props;
          write('<m-state fc="' + fc + '" computed="' + rc.mcs.gen(node) + '">');
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

        // `<toggle>` element
        if (tag === "toggle") {
          const { value: valueProp, children } = props;
          if (children !== undefined) {
            if (isVNode(valueProp) && (valueProp[0] === $state || valueProp[0] === $computed)) {
              const { key, deps, value, fc } = valueProp[1];
              write('<m-state mode="toggle" fc="' + fc + '" ');
              if (key) {
                write("key=" + toAttrStringLit(key) + ">");
                stateStore.set(fc + ":" + key, !!value);
              } else {
                write('computed="' + rc.mcs.gen(valueProp) + '">');
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

        // `<switch>` element
        if (tag === "switch") {
          const { value: valueProp, defaultValue, children } = props;
          if (children !== undefined) {
            let slots = Array.isArray(children) ? (isVNode(children) ? [children] : children) : [children];
            let stateful: string | undefined;
            let computed: string | undefined;
            let valueOrDefault: unknown;
            if (isVNode(valueProp) && (valueProp[0] === $state || valueProp[0] === $computed)) {
              const { key, deps, value, fc } = valueProp[1];
              valueOrDefault = value ?? defaultValue;
              stateful = '<m-state mode="switch" fc="' + fc + '" ';
              if (key) {
                stateful += "key=" + toAttrStringLit(key) + ">";
                stateStore.set(fc + ":" + key, valueOrDefault);
              } else {
                stateful += 'computed="' + rc.mcs.gen(valueProp) + '">';
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
          const { children } = props;
          const fcId = ++rc.status.fcIndex;
          try {
            const fcSlots = children !== undefined
              ? (Array.isArray(children) ? (isVNode(children) ? [children] : children) : [children])
              : undefined;
            const v = tag.call(createThis(fcId, rc.appState, rc.context, rc.request), props);
            if (isObject(v) && !isVNode(v)) {
              if (v instanceof Promise) {
                if ((props.rendering ?? tag.rendering) === "eager") {
                  await renderNode({ ...rc, fcId, fcSlots }, await v);
                } else {
                  const chunkIdAttr = 'chunk-id="' + (rc.status.chunkIndex++).toString(36) + '"';
                  write("<m-portal " + chunkIdAttr + ">");
                  if (props.placeholder) {
                    await renderNode({ ...rc, fcId }, props.placeholder);
                  }
                  write("</m-portal>");
                  rc.suspenses.push(v.then(async (node) => {
                    let buf = "<m-chunk " + chunkIdAttr + "><template>";
                    await renderNode({
                      ...rc,
                      fcId,
                      fcSlots,
                      write: (chunk: string) => {
                        buf += chunk;
                      },
                    }, node);
                    return buf + "</template></m-chunk>";
                  }));
                }
              } else if (Symbol.asyncIterator in v) {
                if ((props.rendering ?? tag.rendering) === "eager") {
                  for await (const c of v) {
                    await renderNode({ ...rc, fcId, fcSlots }, c);
                  }
                } else {
                  const chunkIdAttr = 'chunk-id="' + (rc.status.chunkIndex++).toString(36) + '"';
                  write("<m-portal " + chunkIdAttr + ">");
                  if (props.placeholder) {
                    await renderNode({ ...rc, fcId }, props.placeholder);
                  }
                  write("</m-portal>");
                  const iter = () =>
                    rc.suspenses.push(
                      v.next().then(async ({ done, value }) => {
                        let buf = "<m-chunk " + chunkIdAttr;
                        if (done) {
                          return buf + " done></m-chunk>";
                        }
                        buf += " next><template>";
                        await renderNode({
                          ...rc,
                          fcId,
                          fcSlots,
                          write: (chunk: string) => {
                            buf += chunk;
                          },
                        }, value);
                        iter();
                        return buf + "</template></m-chunk>";
                      }),
                    );
                  iter();
                }
              } else if (Symbol.iterator in v) {
                for (const node of v) {
                  await renderNode({ ...rc, fcId, fcSlots }, node);
                }
              }
            } else if (v || v === 0) {
              await renderNode({ ...rc, fcId, fcSlots }, v);
            }
          } catch (err) {
            if (err instanceof Error) {
              if (props.catch) {
                await renderNode({ ...rc, fcId }, props.catch(err));
              } else {
                write('<pre style="color:red;font-size:1rem"><code>' + escapeHTML(err.message) + "</code></pre>");
                console.error(err);
              }
            }
          }
          break;
        }

        // regular html element
        if (isString(tag) && regexpHtmlTag.test(tag)) {
          let buffer = "<" + tag;
          let stateTags = "";
          for (let [propName, propValue] of Object.entries(props)) {
            if (propName === "children") {
              continue;
            }
            if (isVNode(propValue) && (propValue[0] === $state || propValue[0] === $computed)) {
              const { key, value, deps, fc } = propValue[1];
              if (propName === "class") {
                rc.status.cx = true;
              } else if (propName === "style") {
                rc.status.styleToCSS = true;
              }
              stateTags += "<m-state mode=" + toAttrStringLit("[" + propName + "]") + ' fc="' + fc + '" ';
              if (key) {
                stateTags += "key=" + toAttrStringLit(key) + ">";
                stateStore.set(fc + ":" + key, value);
              } else {
                stateTags += 'computed="' + rc.mcs.gen(propValue) + '">';
                for (const [key, value] of Object.entries(deps)) {
                  if (!stateStore.has(key)) {
                    stateStore.set(key, value);
                  }
                }
              }
              stateTags += "</m-state>";
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
                    let id: string;
                    let cssSelector: string;
                    let cssIds: Set<string>;
                    if (style.length > 0) {
                      css = styleToCSS(style);
                      raw += css + "|";
                    }
                    raw += [pseudoStyles, atRuleStyles, nestingStyles].flat(1).map(([k, v]) => k + ">" + v).join("|");
                    id = hashCode(raw).toString(36);
                    cssSelector = "[data-css-" + id + "]";
                    cssIds = rc.cssIds ?? (rc.cssIds = new Set());
                    if (!cssIds.has(id)) {
                      cssIds.add(id);
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
                  rc.status.onmount++;
                  buffer += ' onmount="$emit(event,' + rc.mfs.gen(propValue) + str(rc.fcId, (i) => "," + i) + ')"';
                }
                break;
              case "action":
                if (typeof propValue === "function" && tag === "form") {
                  buffer += ' onsubmit="$onsubmit(event,' + rc.mfs.gen(propValue) + str(rc.fcId, (i) => "," + i) + ')"';
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
                      buffer += " " + propName.toLowerCase() + '="$emit(event,'
                        + rc.mfs.gen(propValue)
                        + str(rc.fcId, (i) => "," + i)
                        + ')"';
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
            if (stateTags) {
              write(stateTags);
            }
            if (props.innerHTML) {
              write(props.innerHTML);
            } else if (props.children !== undefined) {
              await renderChildren(rc, props.children);
            }
            write("</" + tag + ">");
          } else if (stateTags) {
            write("<m-group>" + stateTags + "</m-group>");
          }
        }
      } else if (Array.isArray(node) && node.length > 0) {
        renderChildren(rc, node, stripSlotProp);
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

class IdGenImpl<T> extends Map<T, string> implements IdGen<T> {
  private _id = 0;
  constructor(private _prefix: string) {
    super();
  }
  gen(v: T) {
    let id = this.get(v);
    if (id === undefined) {
      id = this._prefix + (this._id++).toString(36);
      this.set(v, id);
    }
    return id;
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
        const { appState: appStateInit, context, htmx } = renderOptions;
        const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
        const appState = createThis(0, null, context, request);
        const stateStore = new Map<string, unknown>();
        const suspenses: Promise<string>[] = [];
        const rc: RenderContext = {
          write,
          suspenses,
          context,
          request,
          appState,
          stateStore,
          mcs: new IdGenImpl<VNode>("$MC_"),
          mfs: new IdGenImpl<CallableFunction>("$MF_"),
          status: { fcIndex: 0, chunkIndex: 0, onmount: 0 },
        };
        const runtimeJS: RuntimeJSMeta = {};
        // finalize creates runtime JS for client
        // it may be called recursively when thare are unresolved suspenses
        const finalize = async () => {
          let js = "";
          if (rc.status.cx && !runtimeJS.cx) {
            runtimeJS.cx = true;
            js += UTILS_JS.cx;
          }
          if (rc.status.styleToCSS && !runtimeJS.styleToCSS) {
            runtimeJS.styleToCSS = true;
            js += UTILS_JS.styleToCSS;
          }
          if (rc.mfs.size > 0 && !runtimeJS.event) {
            runtimeJS.event = true;
            js += UTILS_JS.event;
          }
          if (suspenses.length > 0 && !runtimeJS.suspense) {
            runtimeJS.suspense = true;
            js += SUSPENSE_JS;
          }
          if (stateStore.size > 0 && !runtimeJS.state) {
            runtimeJS.state = true;
            js += STATE_JS;
          }
          if (js) {
            write("<script>/* runtime.js (generated by mono-jsx) */(()=>{" + js + "})()</script>");
          }
          js = "";
          if (rc.mfs.size > 0) {
            for (const [fn, fname] of rc.mfs.entries()) {
              js += "function " + fname + "(){(" + fn.toString() + ").apply(this,arguments)};";
            }
            rc.mfs.clear();
          }
          if (stateStore.size > 0) {
            for (const [key, value] of stateStore.entries()) {
              js += "$defineState(" + JSON.stringify(key) + (value !== undefined ? "," + JSON.stringify(value) : "") + ");";
            }
            stateStore.clear();
          }
          if (rc.mcs.size > 0) {
            for (const [vnode, fname] of rc.mcs.entries()) {
              const { fn, deps } = vnode[1];
              js += '$defineComputed("' + fname + '",function(){return(' + fn.toString() + ").call(this)},"
                + JSON.stringify(Object.keys(deps))
                + ");";
            }
            rc.mcs.clear();
          }
          if (rc.status.onmount > 0) {
            rc.status.onmount = 0;
            js += "$onstage();";
          }
          if (js) {
            write("<script>/* app.js (generated by mono-jsx) */" + js + "</script>");
          }
          if (suspenses.length > 0) {
            await Promise.all(suspenses.splice(0, suspenses.length).map((suspense) => suspense.then(write)));
            await finalize();
          }
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
          // htmx integration
          if (htmx) {
            write(`<script src="${cdn}/htmx.org${htmx === true ? "" : escapeHTML("@" + htmx)}/dist/htmx.min.js"></script>`);
            for (const [key, value] of Object.entries(renderOptions)) {
              if (key.startsWith("htmx-ext-") && value) {
                write(`<script src="${cdn}/${key}${value === true ? "" : escapeHTML("@" + value)}"></script>`);
              }
            }
          }
          await finalize();
        } finally {
          controller.close();
        }
      },
    }),
    { headers, status },
  );
}
