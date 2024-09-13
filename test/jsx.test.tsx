import { assert, assertEquals } from "jsr:@std/assert";
import { $fragment, $html, $vnode } from "../jsx.ts";
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
    <span>{1}{"/"}{false}{[<i key={1} />, <i key={2} />]}</span> as VNode,
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
  $state.foo = "bar";
  assertEquals(
    <span>{$state.foo}</span> as VNode,
    [
      "span",
      {
        children: [
          Symbol.for("mono.state"),
          {
            key: "foo",
            value: "bar",
          },
          $vnode,
        ],
      },
      $vnode,
    ],
  );
  $state.num = 1;
  assertEquals(
    <span>{$computed(() => 2 * $state.num)}</span> as VNode,
    [
      "span",
      {
        children: [
          Symbol.for("mono.computed"),
          {
            deps: ["num"],
            value: 2,
            fn: String(() => 2 * $state.num),
          },
          $vnode,
        ],
      },
      $vnode,
    ],
  );
});

Deno.test("[jsx] <html> as a `Response` object", () => {
  const res = (
    <html lang="en" headers={{ cacheControl: "public" }}>
      <head />
      <body />
    </html>
  );
  assert(res instanceof Response);
  assertEquals(res.headers.get("cache-control"), "public");
});
