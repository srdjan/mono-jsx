import type { Children, ChildType, VNode } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";
import { RUNTIME_STATE, RUNTIME_SUSPENSE } from "./runtime/index.ts";
import { $fragment, $vnode, Fragment } from "./jsx-fragment.ts";

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
const iconSvgs = new Map<string, string>();
const isObject = (v: unknown): v is object => typeof v === "object" && v !== null;
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 4 && v[3] === $vnode;
const toAttrStringLit = (str: string) => stringify(escapeHTML(str));

type RenderContext = {
  write(chunk: string): void;
  store: Map<string, any>;
  suspenses: Promise<void>[];
  eager?: boolean;
  slots?: Children | null;
  request?: Request;
  styleMark?: Set<string>;
};

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
        let [tag, props, children] = node;

        // fragment element
        if (tag === $fragment) {
          if (props?.innerHTML) {
            write(props.innerHTML);
          } else if (children) {
            for (const child of children) {
              await renderNode(ctx, child);
            }
          }
          break;
        }

        // `<slot>` element
        if (tag === "slot") {
          const slotName = props?.name;
          if (slotName) {
            children = ctx.slots?.filter((v) => isVNode(v) && v[1]?.slot === slotName) ?? null;
          } else {
            children = ctx.slots?.filter((v) => !isVNode(v) || !v[1]?.slot) ?? null;
          }
          if (!children?.length) {
            // use the children of the slot as fallback if nothing is slotted
            children = node[2];
          }
          if (children) {
            for (const child of children) {
              await renderNode(ctx, child, true);
            }
          }
          break;
        }

        // state elements
        if (tag === "state" || tag === "toggle" || tag === "switch") {
          const mode = tag === "switch" ? 2 : tag === "toggle" ? 1 : 0;
          const name = props?.name;
          const valueProp = props?.value;
          const value = valueProp ?? (name ? store.get(name) : undefined);
          if (name) {
            write('<state-slot mode="' + mode + '" name=' + toAttrStringLit(name) + " hidden></state-slot>");
          }
          if (mode === 1) {
            if (children) {
              if (name) {
                if (!value) {
                  write("<template>");
                }
                for (const child of children) {
                  await renderNode(ctx, child);
                }
                if (value) {
                  write("<!--/-->");
                } else {
                  write("</template>");
                }
              } else if (value) {
                for (const child of children) {
                  await renderNode(ctx, child);
                }
              }
            }
          } else if (mode === 2) {
            if (children) {
              const nodes = children.filter(isVNode);
              let matchedIndex = -1;
              let defaultNode: VNode | undefined;
              for (let idx = 0; idx < nodes.length; idx++) {
                const childNode = nodes[idx];
                const childNodeProps = childNode[1];
                if (childNodeProps?.default) {
                  defaultNode = childNode;
                  continue;
                }
                const key = childNodeProps?.key;
                const matched = (key ?? idx) === value;
                if (matched) {
                  matchedIndex = idx;
                }
                if (name) {
                  write(
                    "<template"
                      + (key !== undefined ? " key=" + toAttrStringLit(String(key)) : "")
                      + (matched ? " matched></template>" : ">"),
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
                write("<template default" + (matchedIndex === -1 ? " matched></template>" : ">"));
                await renderNode(ctx, defaultNode);
                if (matchedIndex === -1) {
                  write("<!--/-->");
                } else {
                  write("</template>");
                }
              }
            }
          } else {
            write(escapeHTML(String(value)));
            if (name) {
              write("<!--/-->");
            }
          }
          if (name && valueProp !== undefined) {
            store.set(name, valueProp);
          }
          break;
        }

        // fc element
        if (typeof tag === "function") {
          const { rendering, placeholder, catch: catchFC, ...restProps } = props ?? Object.create(null);
          let eager = ctx.eager;
          if ((rendering ?? tag.rendering) === "eager") {
            eager = true;
          }
          if (children?.length && tag === Fragment) {
            restProps.children = children;
          }
          try {
            const v = tag(restProps);
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
            const iconName = tag.slice(5);
            const svg = iconSvgs.get(iconName);
            if (svg) {
              write(svg);
              break;
            }
          }
          let openTag = "<" + tag;
          let onMountHandler: (() => void) | undefined;
          if (props) {
            const attrs: Record<string, string> = Object.create(null);
            for (const [key, value] of Object.entries(props)) {
              switch (key) {
                case "class":
                  attrs.class = (attrs.class ? attrs.class + " " : "") + cx(value);
                  break;
                case "style":
                  if (typeof value === "string" && value !== "") {
                    attrs.style = value;
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
                      let styleMark: Set<string>;
                      let id: string;
                      let className: string;
                      if (style.length > 0) {
                        css = styleToCSS(style);
                        raw += css + "|";
                      }
                      raw += [pseudoStyles, atRuleStyles, nestingStyles].flat(1).map(([k, v]) => k + ">" + v).join("|");
                      styleMark = ctx.styleMark ?? (ctx.styleMark = new Set());
                      id = hashCode(raw).toString(36);
                      className = "css-" + id;
                      attrs.class = (attrs.class ? attrs.class + " " : "") + className;
                      if (!styleMark.has(id)) {
                        styleMark.add(id);
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
                      attrs.style = styleToCSS(style);
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
                    attrs.slot = value;
                  }
                  break;
                case "key":
                case "default":
                  // ignore
                  break;
                default:
                  if (htmlTagRegexp.test(key) && value !== undefined) {
                    if (key.startsWith("on")) {
                      if (typeof value === "function") {
                        attrs[key.toLowerCase()] = "(" + value.toString() + ").call(this,event)";
                      }
                    } else {
                      attrs[key] = String(value);
                    }
                  }
              }
            }
            for (const [key, value] of Object.entries(attrs)) {
              openTag += " " + key + "=" + (key.startsWith("on") ? stringify(value) : toAttrStringLit(value));
            }
          }
          write(openTag + ">");
          if (!selfClosingTags.has(tag)) {
            if (props?.innerHTML) {
              write(props.innerHTML);
            } else if (children) {
              for (const child of children) {
                await renderNode(ctx, child);
              }
            }
            write("</" + (tag as string) + ">");
          }
          if (onMountHandler) {
            write(
              "<script>(()=>{var currentScript=document.currentScript;class MountEvent extends Event{constructor(){super('mount')}get target(){return currentScript.previousElementSibling}}setTimeout(()=>{(",
            );
            write(onMountHandler.toString());
            write(")(new MountEvent())},0)})()</script>");
          }
        }
      } else if (node && Symbol.iterator in node) {
        for (const child of node) {
          await renderNode(ctx, child);
        }
      }
      break;
  }
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

  // @ts-ignore if Bun is available, use it
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

/** concatenates class names. */
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
      const cssKey = k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
      const cssValue = typeof v === "number" ? cssBareUnitProps.has(cssKey) ? v.toString() : v + "px" : String(v);
      return cssKey + ":" + (cssKey === "content" ? toAttrStringLit(cssValue) : cssValue);
    })
    .join(";");
}

/** Hash code for strings */
export function hashCode(s: string) {
  return [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
}

export function render(node: VNode, renderOptions?: RenderOptions): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const store = new Map<string, any>();
      const suspenses: Promise<void>[] = [];
      const ctx: RenderContext = { ...renderOptions, store, suspenses, write };
      try {
        write("<!DOCTYPE html>");
        await renderNode(ctx, node);
        if (store.size > 0) {
          write("<script>(()=>{");
          write(RUNTIME_STATE);
          write("for(const[n,v]of");
          write(stringify([...store.entries()]));
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
  const headers: Record<string, string> = {};
  if (renderOptions?.headers) {
    for (const [key, value] of Object.entries(renderOptions.headers)) {
      headers[key.replace(/([a-z])([A-Z])/g, (_, az, AZ) => az + "-" + AZ.toLowerCase())] = value!;
    }
  }
  headers["transfer-encoding"] = "chunked";
  headers["content-type"] = "text/html; charset=utf-8";
  return new Response(readable, { headers });
}

export function iconify(name: string, svg: string): string {
  const svgTagStart = svg.indexOf("<svg");
  const svgTagEnd = svg.indexOf(">", svgTagStart);
  const viewBox = svg.slice(0, svgTagEnd).match(/viewBox=['"]([^'"]+)['"]/)?.[1] ?? "";
  const iconSvgSvg = '<svg class="icon" role="img" aria-hidden="true" style="width:auto;height:1em" fill="none"'
    + " viewBox=" + stringify(viewBox)
    + ' xmlns="http://www.w3.org/2000/svg">'
    + svg.slice(svgTagEnd + 1).replace(/\n/g, "").replace(/=['"](black|#000000)['"]/g, '="currentColor"');
  iconSvgs.set(name, iconSvgSvg);
  return iconSvgSvg;
}
