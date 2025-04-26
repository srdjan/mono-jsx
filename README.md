# mono-jsx

![`<html>` as a `Response`](./.github/html-as-a-response.png)

mono-jsx is a JSX runtime that renders `<html>` element to a `Response` object in JavaScript runtimes like Node.js, Deno, Bun, Cloudflare Workers, etc.

- 🚀 No build step needed
- 🦋 Lightweight(8KB gzipped), zero dependencies
- 🔫 Minimal state runtime
- 🚨 Full Web API types
- ⏳ Streaming rendering
- 🌎 Universal, works in Node.js, Deno, Bun, Cloudflare Workers, etc.

```jsx
export default {
  fetch: (req) => (
    <html>
      <h1>Hello World!</h1>
    </html>
  ),
};
```

## Installation

mono-jsx supports all modern JavaScript runtimes including Node.js, Deno, Bun, Cloudflare Workers, etc.
You can install it via `npm i`, `deno add`, or `bun add`.

```bash
# Node.js, Cloudflare Workers, or other node-compatible runtimes
npm i mono-jsx
# Deno
deno add npm:mono-jsx
# Bun
bun add mono-jsx
```

## Setup JSX Runtime

To use mono-jsx as JSX runtime, add the following configuration to your `tsconfig.json`(`deno.json` for Deno):

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
```

Alternatively, you can also use pragma directive in your JSX file.

```js
/** @jsxImportSource mono-jsx */
```

You can also run `mono-jsx setup` to automatically add the configuration to your `tsconfig.json` or `deno.json`.

```bash
# Node.js, Cloudflare Workers, or other node-compatible runtimes
npx mono-jsx setup
# Deno
deno run npm:mono-jsx setup
# Bun
bunx mono-jsx setup
```

## Usage

To create a html response in server-side, you just need to return a `<html>` element in the `fetch` handler.

```tsx
// app.tsx

export default {
  fetch: (req) => (
    <html>
      <h1>Hello World!</h1>
    </html>
  ),
};
```

For Deno/Bun users, you can run the `app.tsx` directly.

```bash
deno serve app.tsx
bun run app.tsx
```

If you are building a web app with [Cloudflare Workers](https://developers.cloudflare.com/workers/wrangler/commands/#dev), use `wrangler dev` command to start the app in local development mode.

```bash
npx wrangler dev app.tsx
```

**Node.js does not support JSX syntax and declarative fetch server**, we recommend using mono-jsx with [srvx](https://srvx.h3.dev/).

```tsx
// app.tsx

import { serve } from "srvx";

serve({
  port: 3000,
  fetch: (req) => (
    <html>
      <h1>Hello World!</h1>
    </html>
  ),
});
```

and you will need [tsx](https://www.npmjs.com/package/tsx) to start the app.

```bash
npx tsx app.tsx
```

## Using JSX

mono-jsx uses [**JSX**](https://react.dev/learn/describing-the-ui) to describe the user interface, similar to React but with some differences.

### Using Standard HTML Property Names

mono-jsx uses standard HTML property names instead of React's overthinked property names.

- `className` -> `class`
- `htmlFor` -> `for`
- `onChange` -> `onInput`

### Composition `class`

mono-jsx allows you to compose the `class` property using an array of strings, objects, or expressions.

```jsx
<div class={["container box", isActive && "active", { hover: isHover }]} />;
```

### Using Pseudo Classes and Media Queries in the `style` Property

mono-jsx allows you to use [pseudo classes](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes), [pseudo elements](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements), [media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries), and [css nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Using_CSS_nesting) in the `style` property.

```jsx
<a
  style={{
    color: "black",
    "::after": { content: "↩️" },
    ":hover": { textDecoration: "underline" },
    "@media (prefers-color-scheme: dark)": { color: "white" },
    "& .icon": { width: "1em", height: "1em", marginRight: "0.5em" },
  }}
>
  <img class="icon" src="link.png" />
  Link
</a>;
```

### `<slot>` Element

mono-jsx uses [`<slot>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot) element to render the slotted content(Equivalent to React's `children` proptery). Plus, you also can add the `name` attribute to define a named slot.

```jsx
function Container() {
  return (
    <div class="container">
      <slot /> {/* <h1>Hello world!</h1> */}
      <slot name="desc" /> {/* <p>This is a description.</p> */}
    </div>
  );
}

function App() {
  return (
    <Container>
      <p slot="desc">This is a description.</p>
      <h1>Hello world!</h1>
    </Container>
  );
}
```

### `html` Tag Function

mono-jsx doesn't support the `dangerouslySetInnerHTML` property, instead, it provides a `html` tag function to render raw HTML in JSX.

```jsx
function App() {
  return <div>{html`<h1>Hello world!</h1>`}</div>;
}
```

The `html` tag function is a global function injected by mono-jsx, you can use it in any JSX expression without importing it.
You also can use the `css` and `js`, that are just aliases of the `html` tag function, to render CSS and JavaScript code.

```jsx
function App() {
  return (
    <head>
      <style>{css`h1 { font-size: 3rem; }`}</style>
      <script>{js`console.log("Hello world!")`}</script>
    </head>
  );
}
```

> [!WARNING]
> the `html` tag function is **unsafe** that can cause [**XSS**](https://en.wikipedia.org/wiki/Cross-site_scripting) vulnerabilities.

### Event Handlers

mono-jsx allows you to write event handlers directly in the JSX code, like React.

```jsx
function Button() {
  return <button onClick={(evt) => alert("BOOM!")}>Click Me</button>;
}
```

> [!NOTE]
> the event handler would never be called in server-side. Instead it will be serialized to a string and sent to the client-side. **This means you should NOT use any server-side variables or functions in the event handler.**

```tsx
function Button(this: FC, props: { role: string }) {
  let message = "BOOM!";
  console.log(message); // only print message in server-side
  return (
    <button
      role={props.role}
      onClick={(evt) => {
        alert(message);           // ❌ `message` is a server-side variable
        console.log(props.role);  // ❌ `props` is a server-side variable
        Deno.exit(0);             // ❌ `Deno` is unavailable in the browser
        document.title = "BOOM!"; // ✅ `document` is a browser API
        console.log(evt.target);  // ✅ `evt` is the event object
        this.count++;             // ✅ update the state `count`
      }}
    >
      Click Me
    </button>
  );
}
```

Plus, mono-jsx supports the `mount` event that will be triggered when the element is mounted in the client-side.

```jsx
function App() {
  return (
    <div onMount={(evt) => console.log(evt.target, "Mounted!")}>
      <h1>Hello World!</h1>
    </div>
  );
}
```

## Using State

mono-jsx provides a minimal state runtime that allows you to update view based on state changes in client-side.

```tsx
function Counter(
  this: FC<{ count: number }>,
  props: { initialCount?: number },
) {
  this.count = props.initialCount ?? 0;
  return (
    <div>
      {/* use the state */}
      <span>{this.count}</span>
      {/* use computed state */}
      <span>doubled: {this.computed(() => 2 * this.count)}</span>
      {/* update the state in event handlers */}
      <button onClick={() => this.count--}>-</button>
      <button onClick={() => this.count++}>+</button>
    </div>
  );
}
```

> [!WARNING]
> The state cannot be used in an arrow function component, you should use a `function` declaration instead.

```jsx
// ❌ `this.count++` won't update the view, please use a function declaration instead
const App = () => {
  this.count = 0;
  return (
    <div>
      <span>{this.count}</span>
      <button onClick={() => this.count++}>+</button>
    </div>
  );
};
```

## Built-in Elements

mono-jsx provides some built-in elements to help you build your app.

### `<toggle>` element

`<toggle>` element allows you to toggle the visibility of the slotted content.

```tsx
function App(this: FC<{ show: boolean }>) {
  this.show = false;
  return (
    <div>
      <toggle value={this.show}>
        <h1>Hello World!</h1>
      </toggle>
      <button onClick={toggle}>{this.computed(() => this.show ? "Hide" : "Show")}</button>
    </div>
  );
  function toggle() {
    this.show = !this.show;
  }
}
```

### `<switch>` element

`<switch>` element allows you to switch the slotted content based on the `value` property. You need to define the `slot` attribute in the slotted content to match the `value`, otherwise, the default slots will be rendered.

```tsx
function App(this: FC<{ lang: "en" | "zh" | "emoji" }>) {
  this.lang = "en";
  return (
    <div>
      <switch value={this.lang}>
        <h1 slot="en">Hello, world!</h1>
        <h1 slot="zh">你好，世界！</h1>
        <h1>✋🌎❗️</h1>
      </switch>
      <button onClick={() => this.lang = "en"}>English</button>
      <button onClick={() => this.lang = "zh"}>中文</button>
      <button onClick={() => this.lang = "emoji"}>Emoji</button>
    </div>
  );
}
```

## Streaming Rendering

mono-jsx renders your `<html>` as a readable stream, that allows async function components are rendered asynchrously. You can set a `placeholder` attribute to show a loading state while the async component is loading.

```jsx
async function Sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return <solt />;
}

export default {
  fetch: (req) => (
    <html>
      <h1>Hello World!</h1>
      <Sleep ms={1000} placeholder={<p>Sleeping...</p>}>
        <p>After 1 second</p>
      </Sleep>
    </html>
  ),
};
```

You can also set `rendering` attribute to "eager" to render the async component eagerly, which means the async component will be rendered as a sync function component and the `placeholder` will be ignored.

```jsx
async function Sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return <solt />;
}

export default {
  fetch: (req) => (
    <html>
      <h1>Hello World!</h1>
      <Sleep ms={1000} rendering="eager">
        <p>After 1 second</p>
      </Sleep>
    </html>
  ),
};
```

## Accessing Request Info

You can access the request info in a function component by using the `request` property in the `this` context. And you must pass the `request` object to the root `<html>` element to make it work.

```tsx
function RequestInfo(this: FC) {
  const { request } = this;
  return (
    <div>
      <h1>Request Info</h1>
      <p>{request.method}</p>
      <p>{request.url}</p>
      <p>{request.headers.get("user-agent")}</p>
    </div>
  );
}

export default {
  fetch: (req) => (
    <html request={req}>
      <RequestInfo />
    </html>
  ),
};
```

## Customizing Response

You can add `status` or `headers` attribute to the `<html>` element to customize the response.

```jsx
export default {
  fetch: (req) => (
    <html
      status={404}
      headers={{
        cacheControl: "public, max-age=0, must-revalidate",
        setCookie: "name=value",
      }}
    >
      <h1>Page Not Found</h1>
    </html>
  ),
};
```

## License

[MIT](LICENSE)
