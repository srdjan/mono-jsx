/* @jsxImportSource mono-jsx */
import { assertEquals } from "jsr:@std/assert";
import { hashCode } from "mono-jsx";
import { RUNTIME_STATE, RUNTIME_SUSPENSE } from "../runtime/index.ts";

const renderToString = (node: JSX.Element, request?: Request) => {
  const res = (
    <html lang="en" request={request}>
      <body>{node}</body>
    </html>
  );
  return res.text();
};

Deno.test("[render] condition&loop", async () => {
  const If = ({ value }: { value: boolean }) => {
    if (value) {
      return <slot />;
    }
    return null;
  };
  function* For({ value }: { value: any[] }) {
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

Deno.test("[render] merge class names", async () => {
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

Deno.test("[render] style", async () => {
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
        <button class="button" style={{ backgroundColor: "#fff", ":hover": { backgroundColor: "#eee" } }}>Click me</button>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">.css-${id}{background-color:#fff}.css-${id}:hover{background-color:#eee}</style>`,
        `<button class="button css-${id}">Click me</button>`,
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
    const id = hashCode("color:black|& strong>color:grey").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "& strong": { color: "grey" } }}>
          <strong>Hello</strong> World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">.css-${id}{color:black}.css-${id} strong{color:grey}</style>`,
        `<h1 class="title css-${id}"><strong>Hello</strong> World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }
});

Deno.test("[render] event handler", async () => {
  assertEquals(
    await renderToString(<button onClick={() => console.log("🔥" as string)}>Click me</button>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<button onclick="(()=>console.log(\\"🔥\\")).call(this,event)">Click me</button>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<div onMount={(e) => console.log(e.target)}>Using HTML</div>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>Using HTML</div>`,
      `<script>setTimeout(()=>{const e=new Event('mount');e.target=currentScript.previousElementSibling;(`,
      `(e)=>console.log(e.target))(e)`,
      `},0)</script>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[render] <slot>", async () => {
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

Deno.test("[render] XSS", async () => {
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

Deno.test("[render] Async component", async (t) => {
  const dir = new URL("..", import.meta.url).pathname;
  const entries = [...Deno.readDirSync(dir)];

  async function ReadDir({ path }: { path: string }) {
    const entryNames = [];
    for await (const entry of Deno.readDir(path)) {
      entryNames.push(entry.name);
    }
    return <ul>{entryNames.map((name) => <li key={name}>{name}</li>)}</ul>;
  }

  await t.step("eager rendering", async () => {
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
  });

  await t.step("without placeholder", async () => {
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
  });

  await t.step("with placeholder", async () => {
    const App = () => <ReadDir path={dir} placeholder={<p>loading...</p>} />;
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<suspense-slot chunk-id="1" with-placeholder hidden></suspense-slot>`,
        `<p>loading...</p>`,
        `<!--/placeholder-->`,
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
  });
});

Deno.test("[render] Async generator component", async (t) => {
  const dir = new URL("..", import.meta.url).pathname;
  const entries = [...Deno.readDirSync(dir)];

  async function* ReadDir({ path }: { path: string }) {
    const entries = Deno.readDir(path);
    for await (const { name } of entries) {
      yield <li key={name}>{name}</li>;
    }
  }

  await t.step("eager rendering", async () => {
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
  });
});

Deno.test("[render] catch error", async () => {
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
    foo: "bar";
    show: boolean;
    n: number;
  }
}

Deno.test("[render] <use-state>", async () => {
  assertEquals(
    await renderToString(<use-state name="foo" value={"bar"} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<state-slot name="foo" hidden></state-slot>`,
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
    await renderToString(
      <use-state toggle name="show" value={true}>
        <h1>👋</h1>
      </use-state>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<state-slot name="show" toggle hidden></state-slot>`,
      `<h1>👋</h1><!--/-->`,
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
      <use-state toggle name="show" value={false}>
        <h1>👋</h1>
      </use-state>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<state-slot name="show" toggle hidden></state-slot>`,
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
      <use-state switch name="n" value={0}>
        <span>0</span>
        <span>1</span>
        <span>2</span>
      </use-state>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<state-slot name="n" switch hidden></state-slot>`,
      `<template key="0" matched></template><span>0</span><!--/-->`,
      `<template key="1"><span>1</span></template>`,
      `<template key="2"><span>2</span></template>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["n",0]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <use-state switch name="n" value={1}>
        <span>0</span>
        <span>1</span>
        <span>2</span>
      </use-state>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<state-slot name="n" switch hidden></state-slot>`,
      `<template key="0"><span>0</span></template>`,
      `<template key="1" matched></template><span>1</span><!--/-->`,
      `<template key="2"><span>2</span></template>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["n",1]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <use-state switch name="n" value={2}>
        <span>0</span>
        <span>1</span>
        <span>2</span>
      </use-state>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<state-slot name="n" switch hidden></state-slot>`,
      `<template key="0"><span>0</span></template>`,
      `<template key="1"><span>1</span></template>`,
      `<template key="2" matched></template><span>2</span><!--/-->`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(const[n,v]of`,
      `[["n",2]]`,
      `)createState(n,v);})()</script>`,
    ].join(""),
  );
});

Deno.test("[render] <cache>", async () => {
});
