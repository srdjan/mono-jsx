import { assert, assertEquals } from "jsr:@std/assert";
import { Fragment } from "mono-jsx/jsx-runtime";
import { $vnode } from "../jsx.ts";
import type { VNode } from "../types/jsx.d.ts";

Deno.test("[jsx] jsx to vnode", () => {
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
          [
            ["i", { key: 1 }, $vnode],
            ["i", { key: 2 }, $vnode],
          ],
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
      Fragment,
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
  const App = (_: { foo: "bar" }) => null;
  assertEquals(
    <App foo="bar" /> as VNode,
    [App, { foo: "bar" }, $vnode],
  );
});

Deno.test("[jsx] <html> as a `Response` object", () => {
  const res = (
    <html lang="en" headers={{ cacheControl: "public" }}>
      <head>
        <title>Hello world!</title>
      </head>
      <body>
        <h1>Hello world!</h1>
      </body>
    </html>
  );
  assert(res instanceof Response);
  assertEquals(res.headers.get("cache-control"), "public");
  assertEquals([...res], [
    "html",
    {
      lang: "en",
      children: [
        ["head", {
          children: [
            "title",
            {
              children: "Hello world!",
            },
            $vnode,
          ],
        }, $vnode],
        ["body", {
          children: [
            "h1",
            {
              children: "Hello world!",
            },
            $vnode,
          ],
        }, $vnode],
      ],
    },
    $vnode,
  ]);
});
