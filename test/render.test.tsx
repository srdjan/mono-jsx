import { assertEquals } from "jsr:@std/assert";
import { RUNTIME_STATE, RUNTIME_SUSPENSE } from "../runtime/index.ts";

function hashCode(s: string) {
  return [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
}

const renderToString = (node: JSX.Element, request?: Request) => {
  const res = (
    <html lang="en" request={request}>
      <body>{node}</body>
    </html>
  );
  return res.text();
};

Deno.test("[ssr] condition&loop", async () => {
  const If = ({ value }: { value: boolean }) => {
    if (value) {
      return <slot />;
    }
    return null;
  };
  function* For({ value }: { value: unknown[] }) {
    for (const i of value) {
      yield <>{i}</>;
    }
  }
  const App = () => (
    <>
      <h1>{"<"}html{">"} as a Response.</h1>
      <If value={true}>
        <p>
          <For value={["Building", " ", <b>U</b>, "ser", " ", <b>I</b>, "nterfaces", "."]} />
        </p>
      </If>
    </>
  );
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>&lt;html&gt; as a Response.</h1>`,
      `<p>Building <b>U</b>ser <b>I</b>nterfaces.</p>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] merge class names", async () => {
  assertEquals(
    await renderToString(<div class={["box", "large", { border: false, rounded: true }]} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div class="box large rounded"></div>`,
      `</body></html>`,
    ].join(""),
  );

  const ok = false;
  assertEquals(
    await renderToString(<div class={["box", ok && "large", null, undefined, {}]} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div class="box"></div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] style", async () => {
  assertEquals(
    await renderToString(<div style="display:block" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div style="display:block"></div>`,
      `</body></html>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<div style={{ display: "block", border: 1, lineHeight: 1 }} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div style="display:block;border:1px;line-height:1"></div>`,
      `</body></html>`,
    ].join(""),
  );

  "pseudo class";
  {
    const id = hashCode("background-color:#fff|:hover>background-color:#eee").toString(36);
    assertEquals(
      await renderToString(
        <button role="button" style={{ backgroundColor: "#fff", ":hover": { backgroundColor: "#eee" } }}>Click me</button>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">.css-${id}{background-color:#fff}.css-${id}:hover{background-color:#eee}</style>`,
        `<button role="button" class="css-${id}">Click me</button>`,
        `</body></html>`,
      ].join(""),
    );
    assertEquals(
      await renderToString(
        <button class="button" role="button" style={{ backgroundColor: "#fff", ":hover": { backgroundColor: "#eee" } }}>Click me</button>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">.css-${id}{background-color:#fff}.css-${id}:hover{background-color:#eee}</style>`,
        `<button class="button css-${id}" role="button">Click me</button>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "pseudo element";
  {
    const id = hashCode('color:blue|::after>content:"↩"').toString(36);
    assertEquals(
      await renderToString(
        <a class="link" style={{ color: "blue", "::after": { content: "↩" } }}>Link</a>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">.css-${id}{color:blue}.css-${id}::after{content:"↩"}</style>`,
        `<a class="link css-${id}">Link</a>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "@media query";
  {
    const id = hashCode("color:black|@media (prefers-color-scheme: dark)>color:white").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "@media (prefers-color-scheme: dark)": { color: "white" } }}>
          Hello World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">.css-${id}{color:black}@media (prefers-color-scheme: dark){.css-${id}{color:white}}</style>`,
        `<h1 class="title css-${id}">Hello World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "nesting style";
  {
    const id = hashCode("color:black|&.title>font-size:20px|& strong>color:grey").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "&.title": { fontSize: 20 }, "& strong": { color: "grey" } }}>
          <strong>Hello</strong> World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">.css-${id}{color:black}.css-${id}.title{font-size:20px}.css-${id} strong{color:grey}</style>`,
        `<h1 class="title css-${id}"><strong>Hello</strong> World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] event handler", async () => {
  assertEquals(
    await renderToString(<button onClick={() => console.log("🔥" as string)}>Click me</button>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<script>var _EH$0=()=>console.log("🔥")</script>`,
      `<button onclick="_EH$0.call(this,event)">Click me</button>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<div onMount={(e) => console.log(e.target)}>Using HTML</div>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>Using HTML</div>`,
      `<script>(`,
      `(e)=>console.log(e.target)`,
      `)({type:"mount",target:document.currentScript.previousElementSibling})</script>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] <slot>", async () => {
  const Container = () => (
    <div id="container">
      <header>
        <slot name="logo" />
      </header>
      <slot name="poster">
        <img src="/poster.png" />
      </slot>
      <slot />
      <footer>
        <slot name="copyright" />
      </footer>
    </div>
  );
  const Logo = () => <img src="/logo.png" />;
  const App = () => (
    <Container>
      <Logo slot="logo" />
      <p slot="copyright">(c) 2023 All rights reserved.</p>
      <h1>Welcome to Mono!</h1>
      <p>Building user interfaces.</p>
    </Container>
  );
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div id="container">`,
      `<header><img src="/logo.png"></header>`,
      `<img src="/poster.png">`,
      `<h1>Welcome to Mono!</h1>`,
      `<p>Building user interfaces.</p>`,
      `<footer><p>(c) 2023 All rights reserved.</p></footer>`,
      `</div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] XSS", async () => {
  const App = () => (
    <>
      {html`<h1>Welcome to Mono!</h1><script>console.log("Welcomee to Mono!")</script>`}
      <style>{css`body{font-size:"16px"}`}</style>
      <script>{js`console.log('Welcomee to Mono!')`}</script>
    </>
  );
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>Welcome to Mono!</h1><script>console.log("Welcomee to Mono!")</script>`,
      `<style>body{font-size:"16px"}</style>`,
      `<script>console.log('Welcomee to Mono!')</script>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] async component", async () => {
  const dir = new URL("..", import.meta.url).pathname;
  const entries = [...Deno.readDirSync(dir)];

  async function ReadDir({ path }: { path: string }) {
    const entryNames = [];
    for await (const entry of Deno.readDir(path)) {
      entryNames.push(entry.name);
    }
    return <ul>{entryNames.map((name) => <li key={name}>{name}</li>)}</ul>;
  }

  "eager rendering";
  {
    const App = () => <ReadDir path={dir} rendering="eager" />;
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "without placeholder";
  {
    const App = () => <ReadDir path={dir} />;
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<suspense-slot chunk-id="1" hidden></suspense-slot>`,
        `</body></html>`,
        `<script>(()=>{`,
        RUNTIME_SUSPENSE,
        `})()</script>`,
        `<suspense-chunk chunk-id="1" hidden>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</suspense-chunk>`,
      ].join(""),
    );
  }

  "with placeholder";
  {
    const App = () => <ReadDir path={dir} placeholder={<p>loading...</p>} />;
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<suspense-slot chunk-id="1" with-placeholder hidden></suspense-slot>`,
        `<p>loading...</p>`,
        `<!--/-->`,
        `</body></html>`,
        `<script>(()=>{`,
        RUNTIME_SUSPENSE,
        `})()</script>`,
        `<suspense-chunk chunk-id="1" hidden>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</suspense-chunk>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] async generator component", async () => {
  const dir = new URL("..", import.meta.url).pathname;
  const entries = [...Deno.readDirSync(dir)];

  async function* ReadDir({ path }: { path: string }) {
    const entries = Deno.readDir(path);
    for await (const { name } of entries) {
      yield <li key={name}>{name}</li>;
    }
  }

  "eager rendering";
  {
    const App = () => (
      <ul>
        <ReadDir path={dir} rendering="eager" />
      </ul>
    );
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</body></html>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] catch error", async () => {
  const Boom = () => {
    throw new Error("Boom!");
  };
  assertEquals(
    await renderToString(<Boom catch={(err) => <p>error: {err.message}</p>} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<p>error: Boom!</p>`,
      `</body></html>`,
    ].join(""),
  );
});

declare global {
  interface State {
    foo: string;
    show: boolean;
    num: number;
    select: string;
  }
}

Deno.test("[ssr] using state", async () => {
  assertEquals(
    await renderToString(<state name="foo" value={"bar"} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-state name="foo" hidden></mono-state>`,
      `bar`,
      `<!--/-->`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["foo","bar"]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<state name="foo" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-state name="foo" hidden></mono-state>`,
      `<!--/-->`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["foo"]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <toggle name="show" value={true}>
        <h1>👋</h1>
      </toggle>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-toggle name="show" hidden></mono-toggle>`,
      `<template leading></template><h1>👋</h1><!--/-->`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["show",true]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <toggle name="show" value={false}>
        <h1>👋</h1>
      </toggle>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-toggle name="show" hidden></mono-toggle>`,
      `<template><h1>👋</h1></template>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["show",false]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch name="num" value={0}>
        <span>0</span>
        <span>1</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-switch name="num" hidden></mono-switch>`,
      `<template leading></template><span>0</span><!--/-->`,
      `<template><span>1</span></template>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["num",0]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch name="num" value={1}>
        <span>0</span>
        <span>1</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-switch name="num" hidden></mono-switch>`,
      `<template><span>0</span></template>`,
      `<template leading></template><span>1</span><!--/-->`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["num",1]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch name="num" value={3}>
        <span>0</span>
        <span>1</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-switch name="num" hidden></mono-switch>`,
      `<template><span>0</span></template>`,
      `<template><span>1</span></template>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["num",3]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch name="select" value={"a"}>
        <span key="a">A</span>
        <span key="b">B</span>
        <span default>NULL</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-switch name="select" hidden></mono-switch>`,
      `<template key="a" leading></template><span>A</span><!--/-->`,
      `<template key="b"><span>B</span></template>`,
      `<template default><span>NULL</span></template>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["select","a"]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch name="select" value={"b"}>
        <span key="a">A</span>
        <span key="b">B</span>
        <span default>NULL</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-switch name="select" hidden></mono-switch>`,
      `<template key="a"><span>A</span></template>`,
      `<template key="b" leading></template><span>B</span><!--/-->`,
      `<template default><span>NULL</span></template>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["select","b"]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch name="select" value={"c"}>
        <span key="a">A</span>
        <span key="b">B</span>
        <span default>NULL</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<mono-switch name="select" hidden></mono-switch>`,
      `<template key="a"><span>A</span></template>`,
      `<template key="b"><span>B</span></template>`,
      `<template default leading></template><span>NULL</span><!--/-->`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["select","c"]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <cache>", async () => {
});
