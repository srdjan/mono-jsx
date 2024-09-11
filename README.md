# mono-jsx

`<html>` as a `Response`.

```jsx
/* @jsxImportSource mono-jsx */

export default {
  fetch: (request) => (
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
deno add @ije/mono-jsx
# Bun
bun add mono-jsx
```

## Setup JSX runtime

To use mono-jsx as the JSX runtime, add the following configuration to your `tsconfig.json`(`deno.json` for Deno):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
```

Alternatively, you can use pragma directive in your JSX file.

```js
/* @jsxImportSource mono-jsx */
```

## Usage

mono-jsx is a JSX runtime that renders `<html>` element to a `Response` object for server-side rendering(SSR) in JavaScript runtimes like Node.js, Deno, Bun, Cloudflare Workers, etc.

```jsx
// app.jsx

export default {
  fetch: (request) => (
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

If you are building an web app with [Cloudflare Workers](https://developers.cloudflare.com/workers/wrangler/commands/#dev), you can use the `wrangler dev` command to start the app in local development.

```bash
npx wrangler dev app.jsx
```

## Using JSX

mono-jsx uses [**JSX**](https://react.dev/learn/describing-the-ui) to describe the HTML structure, similar to React but with some differences.

### Using Standard HTML Property Names

mono-jsx uses standard HTML property names instead of React's special property:

- `className` -> `class`
- `htmlFor` -> `for`
- `onInput` -> `onChange`

### Composition `class`

mono-jsx allows you to compose the `class` property using an array of strings, objects, or expressions.
The idea is inspired by [Classnames](https://github.com/JedWatson/classnames).

```jsx
<div class={["container box", isActive && "active", { hover: isHover }]} />;
```

### Using Pseudo Classes and Media Queries in the `style` Property

mono-jsx allows you to use [pseudo classes](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes), [pseudo elements](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements), [media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries), and [css nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Using_CSS_nesting) in the `style` property.

```jsx
<a
  style={{
    color: "black",
    "::after": { content: '↩️' },
    ":hover": { textDecoration: "underline" },
    "@media (prefers-color-scheme: dark)": { color: "white" },
    "& .icon": { width: "1em", height: "1em", marginRight: "0.5em" },
  }}
>
  <img class="icon" src="link.png" >
  Link
</a>;
```

### `<slot>` Component

mono-jsx uses [`<slot>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot) element to render the slotted content(Equivalent to React's `children` proptery). You can add the `name` attribute to define a named slot.

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

mono-jsx doesn't support the `dangerouslySetInnerHTML` property, instead, it provides a
`html` tag function to render raw HTML in JSX.

```jsx
function App() {
  return <div>{html`<h1>Hello world!</h1>`}</div>;
}
```

> [!NOTE]
> The `html` tag function is a global function injected by mono-jsx, you can use it in any JSX expression without importing it.

> [!WARNING]
> the `html` tag function is **unsafe** that can cause [**XSS**](https://en.wikipedia.org/wiki/Cross-site_scripting) vulnerabilities.

### Event Handlers

mono-jsx allows you to write event handlers directly in the JSX code, like React.

```jsx
function Button() {
  return <button onClick={(evt) => alert("BOOM!")}>Click Me</button>;
}
```

However, the event handler would never be called at SSR time. It will be transformed into a string and sent to the client-side. **This means you should NOT use any server-side variables or functions in the event handler.**

```jsx
function Button() {
  let message = "BOOM!";
  return (
    <button
      onClick={(evt) => {
        Deno.exit(0); // ❌ Deno is unavailable in the browser
        alert(message); // ❌ message is not defined
        document.title = "BOOM!"; // ✅ document is a browser API
      }}
    >
      Click Me
    </button>
  );
}
```

Plus, mono-jsx supports the `onMount` event handler that will be called when the component is mounted.

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

To use state in mono-jsx, add `<state name="STATE_NAME" value={"initial"} />` to the JSX code, then you can access/update the state using `state.STATE_NAME`, the view will be updated automatically when the state changes.

```jsx
function App() {
  return (
    <div>
      <button onClick={() => state.counter--}>-</button>
      <strong>
        <state name="counter" value={0} />
      </strong>
      <button onClick={() => state.counter++}>+</button>
    </div>
  );
}
```

> [!IMPORTANT]
> state in mono-jsx is global and can be accessed from any component event handlers or external JavaScript code. **Ensure to use unique names for each state to avoid conflicts.**

### `<toggle>` component

`<toggle>` component allows you to toggle the visibility of the slotted content.

```jsx
function App() {
  return (
    <div>
      <toggle name="show" value={true}>
        <h1>Hello World!</h1>
      </toggle>
      <button onClick={() => state.show = !state.show}>Toggle</button>
    </div>
  );
}
```

### `<switch>` component

Use `<switch>` component to render a child element based on the value of the state.

```jsx
function App() {
  return (
    <div>
      <switch name="image" value={0}>
        <Image1 />
        <Image2 />
        <Image3 />
      </switch>
      <button onClick={() => state.image = (state.image + 1) % 3}>Switch Image</button>
    </div>
  );
}
```

You can add an unique `key` to each child element as the `<switch>` component uses the key to identify the child element to render, or the `default` proptery to set a default child element to render when the value is not matched.

```jsx
function App() {
  return (
    <div>
      <switch name="image" value="image-1">
        <Image1 key="image-1" />
        <Image2 key="image-2" />
        <Image3 key="image-3" />
        <Image4 default />
      </switch>
      <button onClick={() => state.image = "image-1"}>Switch Image(#1)</button>
      <button onClick={() => state.image = "image-2"}>Switch Image(#2)</button>
      <button onClick={() => state.image = "image-3"}>Switch Image(#3)</button>
      <button onClick={() => state.image = "whatever"}>Switch Image(default)</button>
    </div>
  );
}
```

## Streaming Rendering

By default, mono-jsx renders your `<html>` app streamingly.

```jsx
async function Sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return <solt />;
}

export default {
  fetch: (request) => (
    <html>
      <h1>Hello World!</h1>
      <Sleep ms={1000} placeholder={<p>Sleeping...</p>}>
        <p>After 1 second</p>
      </Sleep>
    </html>
  ),
};
```

## Partial Cache
