import { assertEquals } from "jsr:@std/assert";
import { RUNTIME_STATE, RUNTIME_SUSPENSE } from "../runtime/index.ts";

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
  assertEquals(
    await renderToString(<div class={["box", false && "large", null, undefined, {}]} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div class="box"></div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] style", async () => {
  const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);

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
        `<style id="css-${id}">[data-css-${id}]{background-color:#fff}[data-css-${id}]:hover{background-color:#eee}</style>`,
        `<button role="button" data-css-${id}>Click me</button>`,
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
        `<style id="css-${id}">[data-css-${id}]{color:blue}[data-css-${id}]::after{content:"↩"}</style>`,
        `<a class="link" data-css-${id}>Link</a>`,
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
        `<style id="css-${id}">[data-css-${id}]{color:black}@media (prefers-color-scheme: dark){[data-css-${id}]{color:white}}</style>`,
        `<h1 class="title" data-css-${id}>Hello World!</h1>`,
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
        `<style id="css-${id}">[data-css-${id}]{color:black}[data-css-${id}].title{font-size:20px}[data-css-${id}] strong{color:grey}</style>`,
        `<h1 class="title" data-css-${id}><strong>Hello</strong> World!</h1>`,
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
      `<script>var _m_fn_0=()=>console.log("🔥")</script>`,
      `<button onclick="_m_fn_0.call(this,event)">Click me</button>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(
      <form action={(data) => console.log(data)}>
        <input name="foo" />
      </form>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<script>var _m_fn_0=(data)=>console.log(data)</script>`,
      `<form onsubmit="event.preventDefault();_m_fn_0.call(this,new FormData(this))">`,
      `<input name="foo">`,
      `</form>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<div onMount={(e) => console.log(e.target)}>Using HTML</div>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>Using HTML</div>`,
      `<script>{const target=document.currentScript.previousElementSibling;(`,
      `(e)=>console.log(e.target)`,
      `)({type:"mount",currentTarget:target,target})}</script>`,
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
    return <ul>{entryNames.map((name) => <li>{name}</li>)}</ul>;
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
        `<m-portal chunk-id="1"></m-portal>`,
        `</body></html>`,
        `<script>(()=>{`,
        RUNTIME_SUSPENSE,
        `})()</script>`,
        `<m-chunk chunk-id="1"><template>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
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
        `<m-portal chunk-id="1">`,
        `<p>loading...</p>`,
        `</m-portal>`,
        `</body></html>`,
        `<script>(()=>{`,
        RUNTIME_SUSPENSE,
        `})()</script>`,
        `<m-chunk chunk-id="1"><template>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
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
      yield <li>{name}</li>;
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
    await renderToString(<Boom catch={(err: Error) => <p>error: {err.message}</p>} />),
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
    await renderToString(<span>{$state.foo}</span>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span>`,
      `<m-state use="foo"></m-state>`,
      `</span>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["foo"]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );

  $state.foo = "bar";
  assertEquals(
    await renderToString(<span title={$state.foo}>{$state.foo}</span>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span title="bar">`,
      `<m-state mode="[title]" use="foo"></m-state>`,
      `<m-state use="foo">bar</m-state>`,
      `</span>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["foo","bar"]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] using computed", async () => {
  $state.foo = "foo";
  $state.bar = "bar";
  const message = $computed(() => $state.foo + $state.bar + "!");
  assertEquals(
    await renderToString(<span title={message}>{message}</span>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span title="foobar!">`,
      `<m-state mode="[title]"><script type="computed">$memo(()=>$state.foo + $state.bar + "!",["foo","bar"])</script></m-state>`,
      `<m-state><script type="computed">$memo(()=>$state.foo + $state.bar + "!",["foo","bar"])</script>foobar!</m-state>`,
      `</span>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["foo"],["bar"]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] using <toggle>", async () => {
  assertEquals(
    await renderToString(
      <toggle value={$state.show} defaultValue={true}>
        <h1>👋</h1>
      </toggle>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="toggle" use="show">`,
      `<h1>👋</h1>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["show",true]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <toggle value={$state.show}>
        <h1>👋</h1>
      </toggle>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="toggle" use="show">`,
      `<template m-slot><h1>👋</h1></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["show"]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] using <switch>", async () => {
  assertEquals(
    await renderToString(
      <switch value={$state.select} defaultValue="a">
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="switch" use="select" match="a">`,
      `<span>A</span>`,
      `<template m-slot><span slot="b">B</span><span>C</span><span>D</span></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["select","a"]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch value={$state.select} defaultValue="b">
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="switch" use="select" match="b">`,
      `<span>B</span>`,
      `<template m-slot><span slot="a">A</span><span>C</span><span>D</span></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["select","b"]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch value={$state.select}>
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="switch" use="select">`,
      `<span>C</span><span>D</span>`,
      `<template m-slot><span slot="a">A</span><span slot="b">B</span></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      RUNTIME_STATE,
      `for(let[n,v]of`,
      `[["select"]]`,
      `)defineState(n,v)})()</script>`,
    ].join(""),
  );
});
