import { assert, assertEquals } from "jsr:@std/assert";
import { $fragment, $html, $vnode } from "../symbols.ts";
import type { VNode } from "../types/jsx.d.ts";

Deno.test("[jsx] jsx transform", () => {
  assertEquals(
    <h1>Hello world!</h1> as VNode,
    [
      "h1",
      { children: "Hello world!" },
      $vnode,
    ],
  );
  assertEquals(
    <h1 class={["title", "h1"]} style={{ fontSize: 24, fontFamily: "serif", ":hover": { color: "purple" } }}>Hello world!</h1> as VNode,
    [
      "h1",
      {
        class: ["title", "h1"],
        style: { fontSize: 24, fontFamily: "serif", ":hover": { color: "purple" } },
        children: "Hello world!",
      },
      $vnode,
    ],
  );
  assertEquals(
    <span>{1}/{false}{[<i key={1} />, <i key={2} />]}</span> as VNode,
    [
      "span",
      {
        children: [
          1,
          "/",
          false,
          [["i", { key: 1 }, $vnode], ["i", { key: 2 }, $vnode]],
        ],
      },
      $vnode,
    ],
  );
  assertEquals(
    (
      <>
        <span>Hello</span>
        <span>world!</span>
      </>
    ) as VNode,
    [
      $fragment,
      {
        children: [
          ["span", { children: "Hello" }, $vnode],
          ["span", { children: "world!" }, $vnode],
        ],
      },
      $vnode,
    ],
  );
  assertEquals(
    <foo-bar /> as VNode,
    ["foo-bar", {}, $vnode],
  );
  const App = (_props: { foo: "bar" }) => null;
  assertEquals(
    <App foo="bar" /> as VNode,
    [App, { foo: "bar" }, $vnode],
  );
  assertEquals(
    <div>{html`<h1>Hello world!</h1>`}</div> as VNode,
    [
      "div",
      {
        children: [
          $html,
          { innerHTML: "<h1>Hello world!</h1>" },
          $vnode,
        ],
      },
      $vnode,
    ],
  );
});

Deno.test("[jsx] <html> as a `Response` object", async () => {
  const res: Response = (
    <html lang="en" headers={{ cacheControl: "public" }}>
      <head />
      <body />
    </html>
  );
  assert(res instanceof Response);
  assertEquals(res.headers.get("cache-control"), "public");
  assertEquals(await res.text(), '<!DOCTYPE html><html lang="en"><head></head><body></body></html>');
});
