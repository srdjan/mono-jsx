# mono-jsx

![`<html>` as a `Response`](./.github/html-as-a-response.png)

mono-jsx is a JSX runtime that renders `<html>` element to a `Response` object in JavaScript runtimes like Node.js, Deno, Bun, Cloudflare Workers, etc.

- No build step needed
- Lightweight(7KB gzipped), zero dependencies
- Minimal state runtime
- Streaming rendering
- Universal, works in Node.js, Deno, Bun, Cloudflare Workers, etc.

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

## Setup JSX runtime

To use mono-jsx as the JSX runtime, add the following configuration to your `tsconfig.json`(`deno.json` for Deno):

```jsonc
{
  "compilerOptions": {
    "allowJs": true, // required for `.jsx` extension in Node.js
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
```

You can also run `npx mono-jsx setup` to add the configuration automatically.

```bash
npx mono-jsx setup
```

Alternatively, you can use pragma directive in your JSX file.

```js
/** @jsxImportSource mono-jsx */
```

## Usage

To create a html response in server-side, you just need to return a `<html>` element in the `fetch` method.

```jsx
// app.jsx

export default {
  fetch: (req) => (
    <html>
      <h1>Hello World!</h1>
    </html>
  ),
};
```

For Deno/Bun users, you can run the `app.jsx` directly.

```bash
deno serve app.jsx
bun run app.jsx
```

**Node.js does not support JSX module and declarative fetch server**, we recommend using mono-jsx with [hono](https://hono.dev).

```jsx
import { serve } from "@hono/node-server";
import { Hono } from "hono";
const app = new Hono();

app.get("/", (c) => (
  <html>
    <h1>Hello World!</h1>
  </html>
));

serve(app);
```

and you will need [tsx](https://www.npmjs.com/package/tsx) to start the app.

```bash
npx tsx app.jsx
```

If you are building a web app with [Cloudflare Workers](https://developers.cloudflare.com/workers/wrangler/commands/#dev), you can use the `wrangler dev` command to start the app in local development.

```bash
npx wrangler dev app.jsx
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

```jsx
function Button(props) {
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
        $state.count++;           // ✅ `$state` is the mono-jsx specific variable
        console.log(evt.target);  // ✅ `evt` is the event object
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

```jsx
function App() {
  // Initialize the state 'count' with value `0`
  $state.count = 0;
  return (
    <div>
      {/* use the state */}
      <span>{$state.count}</span>
      {/* computed state */}
      <span>doubled: {$computed(() => 2 * $state.count)}</span>
      {/* update the state in event handlers */}
      <button onClick={() => $state.count--}>-</button>
      <button onClick={() => $state.count++}>+</button>
    </div>
  );
}
```

To support type checking in TypeScript, declare the `State` interface in the global scope:

```ts
declare global {
  interface State {
    count: number;
  }
}
```

> [!NOTE]
> The `$state` and `$computed` are global variables injected by mono-jsx.

## Using `$context` Hook

The `$context` hook allows you to access `request` and `data` which are set in the root `<html>` element.

```tsx
interface IData {
  foo: string;
}

function App() {
  const { request, data } = $context<IData>();
  return (
    <p>
      {request.method} {request.url} {data.foo}
    </p>
  );
}

export default {
  fetch: (req) => (
    <html request={req} data={{ foo: "bar" }}>
      <h1>Hello World!</h1>
      <App />
    </html>
  ),
};
```

> [!WARNING]
> You should call the `$context` hook before any `await` statement in an async component. Otherwise, the `request` will be undefined.

```jsx
async function AsyncApp() {
  const { request } = $context();
  const data = await fetchData(new URL(request.url).searchParams.get("id"));
  const { request } = $context(); // ❌ request is undefined
  return (
    <p>
      {data.title}
    </p>
  );
}
```

## Built-in Elements

mono-jsx provides some built-in elements to help you build your app.

### `<toggle>` element

`<toggle>` element allows you to toggle the visibility of the slotted content.

```jsx
function App() {
  $state.show = false;
  return (
    <div>
      <toggle value={$state.show}>
        <h1>Hello World!</h1>
      </toggle>
      <button onClick={toggle}>{$computed(() => $state.show ? "Hide" : "Show")}</button>
    </div>
  );
  function toggle() {
    $state.show = !$state.show;
  }
}
```

### `<switch>` element

`<switch>` element allows you to switch the slotted content based on the `value` property. You need to define the `slot` attribute in the slotted content to match the `value`, otherwise, the default slots will be rendered.

```jsx
function App() {
  return (
    <div>
      <switch value={$state.lang}>
        <h1 slot="en">Hello, world!</h1>
        <h1 slot="zh">你好，世界！</h1>
        <h1>✋🌎❗️</h1>
      </switch>
      <button onClick={() => $state.lang = "en"}>English</button>
      <button onClick={() => $state.lang = "zh"}>中文</button>
    </div>
  );
}
```

### `<cache>` element

_Work in progress..._

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
