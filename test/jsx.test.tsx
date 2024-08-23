/* @jsx h */
/* @jsxFrag Fragment */
import { assert, assertEquals } from "jsr:@std/assert";
import { $vnode, Fragment, h } from "mono-jsx";
import type { VNode } from "../types/jsx.d.ts";

Deno.test("JSX", () => {
  assertEquals(
    <h1>Hello world</h1> as VNode,
    ["h1", null, ["Hello world"], $vnode],
  );
  assertEquals(
    (
      <>
        <span>Hello</span>
        <span>world</span>
      </>
    ) as VNode,
    [
      Fragment,
      null,
      [
        ["span", null, ["Hello"], $vnode],
        ["span", null, ["world"], $vnode],
      ],
      $vnode,
    ],
  );
  assertEquals(
    <foo-bar /> as VNode,
    ["foo-bar", null, null, $vnode],
  );
  const App = (_: { foo: "bar" }) => null;
  assertEquals(
    <App foo="bar" /> as VNode,
    [App, { foo: "bar" }, null, $vnode],
  );
  const res = (
    <html lang="en" headers={{ "cache-control": "public" }}>
      <head></head>
      <body></body>
    </html>
  );
  assert(res instanceof Response);
  assertEquals(res.headers.get("cache-control"), "public");
  assertEquals([...res], [
    "html",
    { lang: "en" },
    [
      ["head", null, null, $vnode],
      ["body", null, null, $vnode],
    ],
  ]);
});
