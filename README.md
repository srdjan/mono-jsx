# mono-jsx

![`<html>` as a `Response`](./.github/og-image.png)

mono-jsx is a JSX runtime that renders `<html>` element to `Response` object in JavaScript runtimes like Node.js, Deno, Bun, Cloudflare Workers, etc.

- 🚀 No build step needed
- 🦋 Lightweight (8KB gzipped), zero dependencies
- 🔫 Minimal state runtime
- 🚨 Complete Web API TypeScript definitions
- ⏳ Streaming rendering
- 🌎 Universal, works in Node.js, Deno, Bun, Cloudflare Workers, etc.

## Installation

mono-jsx supports all modern JavaScript runtimes including Node.js, Deno, Bun, and Cloudflare Workers.
You can install it via `npm`, `deno`, or `bun`:

```bash
# Node.js, Cloudflare Workers, or other node-compatible runtimes
npm i mono-jsx

# Deno
deno add npm:mono-jsx

# Bun
bun add mono-jsx
```

## Setup JSX Runtime

To use mono-jsx as your JSX runtime, add the following configuration to your `tsconfig.json` (or `deno.json` for Deno):

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
```

Alternatively, you can use a pragma directive in your JSX file:

```js
/** @jsxImportSource mono-jsx */
```

You can also run `mono-jsx setup` to automatically add the configuration to your project:

```bash
# Node.js, Cloudflare Workers, or other node-compatible runtimes
npx mono-jsx setup

# Deno
deno run -A npm:mono-jsx setup

# Bun
bunx mono-jsx setup
```

## Usage

mono-jsx allows you to return an `<html>` JSX element as a `Response` object in the `fetch` handler:

```tsx
// app.tsx
export default {
  fetch: (req) => (
    <html>
      <h1>Welcome to mono-jsx!</h1>
    </html>
  ),
};
```

For Deno/Bun users, you can run the `app.tsx` directly:

```bash
deno serve app.tsx
bun run app.tsx
```

If you're building a web app with [Cloudflare Workers](https://developers.cloudflare.com/workers/wrangler/commands/#dev), use `wrangler dev` to start local development:

```bash
npx wrangler dev app.tsx
```

**Node.js doesn't support JSX syntax or declarative fetch servers**, so we recommend using mono-jsx with [srvx](https://srvx.h3.dev/):

```tsx
// app.tsx
import { serve } from "srvx";

serve({
  port: 3000,
  fetch: (req) => (
    <html>
      <h1>Welcome to mono-jsx!</h1>
    </html>
  ),
});
```

You'll need [tsx](https://www.npmjs.com/package/tsx) to start the app without a build step:

```bash
npx tsx app.tsx
```

## Using JSX

mono-jsx uses [**JSX**](https://react.dev/learn/describing-the-ui) to describe the user interface, similar to React but with key differences.

### Using Standard HTML Property Names

mono-jsx adopts standard HTML property names, avoiding React's custom naming conventions:

- `className` → `class`
- `htmlFor` → `for`
- `onChange` → `onInput`

### Composition with `class`

mono-jsx allows you to compose the `class` property using arrays of strings, objects, or expressions:

```jsx
<div
  class={[
    "container box",
    isActive && "active",
    { hover: isHover },
  ]}
/>;
```

### Using Pseudo Classes and Media Queries in `style`

mono-jsx supports [pseudo classes](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes), [pseudo elements](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements), [media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries), and [CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Using_CSS_nesting) in the `style` property:

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

mono-jsx uses [`<slot>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot) elements to render slotted content (equivalent to React's `children` property). You can also add the `name` attribute to define named slots:

```jsx
function Container() {
  return (
    <div class="container">
      {/* Default slot */}
      <slot />
      {/* Named slot */}
      <slot name="desc" />
    </div>
  );
}

function App() {
  return (
    <Container>
      {/* This goes to the named slot */}
      <p slot="desc">This is a description.</p>
      {/* This goes to the default slot */}
      <h1>Hello world!</h1>
    </Container>
  );
}
```

### `html` Tag Function

mono-jsx provides an `html` tag function to render raw HTML in JSX instead of React's `dangerouslySetInnerHTML`:

```jsx
function App() {
  return <div>{html`<h1>Hello world!</h1>`}</div>;
}
```

The `html` tag function is globally available without importing. You can also use `css` and `js` tag functions for CSS and JavaScript:

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
> The `html` tag function is **unsafe** and can cause [**XSS**](https://en.wikipedia.org/wiki/Cross-site_scripting) vulnerabilities.

### Event Handlers

mono-jsx lets you write event handlers directly in JSX, similar to React:

```jsx
function Button() {
  return (
    <button onClick={(evt) => alert("BOOM!")}>
      Click Me
    </button>
  );
}
```

> [!NOTE]
> Event handlers are never called on the server-side. They're serialized to strings and sent to the client. **This means you should NOT use server-side variables or functions in event handlers.**

```tsx
import { doSomething } from "some-library";

function Button(this: FC, props: { role: string }) {
  let message = "BOOM!";
  console.log(message); // only executes on server-side
  return (
    <button
      role={props.role}
      onClick={(evt) => {
        alert(message);           // ❌ `message` is a server-side variable
        console.log(props.role);  // ❌ `props` is a server-side variable
        doSomething();            // ❌ `doSomething` is imported on the server-side
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

Additionally, mono-jsx supports the `mount` event for when elements are mounted in the client-side DOM:

```jsx
function App() {
  return (
    <div onMount={(evt) => console.log(evt.target, "Mounted!")}>
      <h1>Welcome to mono-jsx!</h1>
    </div>
  );
}
```

mono-jsx also accepts functions for the `action` property on `form` elements, which will be called on form submission:

```tsx
function App() {
  return (
    <form
      action={(data: FormData, event: SubmitEvent) => {
        event.preventDefault(); // true
        console.log(data.get("name"));
      }}
    >
      <input type="text" name="name" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Reactive

mono-jsx provides a minimal state runtime for updating the view based on client-side state changes:

### Using State

You can use `this` to define state in your components. The view will automatically update when the state changes:

```tsx
function Counter(
  this: FC<{ count: number }>,
  props: { initialCount?: number },
) {
  // Initialize state
  this.count = props.initialCount ?? 0;

  return (
    <div>
      {/* render state */}
      <span>{this.count}</span>

      {/* Update state to trigger re-render */}
      <button onClick={() => this.count--}>-</button>
      <button onClick={() => this.count++}>+</button>
    </div>
  );
}
```

### Using Computed Properties

You can use `this.computed` to create computed properties based on state. The computed property will automatically update when the state changes:

```tsx
function App(this: FC<{ input: string }>) {
  this.input = 'Hello, world';
  return (
    <div>
      <h1>{this.computed(() = this.input + "!")}</h1>

      <form
        action={(data: FormData ) => {
          this.input = data.get("input") as string;
        }}
      >
        <input type="text" name="input" value={this.input} />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
```

### Limitation of States

1\. States cannot be used in arrow function components.

```tsx
// ❌ Won't work - state updates won't refresh the view
const App = () => {
  this.count = 0;
  return (
    <div>
      <span>{this.count}</span>
      <button onClick={() => this.count++}>+</button>
    </div>
  );
};

// ✅ Works correctly
function App(this: FC) {
  this.count = 0;
  return (
    <div>
      <span>{this.count}</span>
      <button onClick={() => this.count++}>+</button>
    </div>
  );
}
```

2\. States cannot be computed outside of the `this.computed` method.

```tsx
// ❌ Won't work - state updates won't refresh the view
function App(this: FC<{ message: string }>) {
  this.message = "Hello, world";
  return (
    <div>
      <h1 title={this.message + "!"}>{this.message + "!"}</h1>
      <button onClick={() => this.message = "Clicked"}>
        Click Me
      </button>
    </div>
  );
}

// ✅ Works correctly
function App(this: FC) {
  this.message = "Hello, world";
  return (
    <div>
      <h1 title={this.computed(() => this.message + "!")}>{this.computed(() => this.message + "!")}</h1>
      <button onClick={() => this.message = "Clicked"}>
        Click Me
      </button>
    </div>
  );
}
```

## Built-in Elements

mono-jsx provides built-in elements to help you build reactive UIs.

### `<toggle>` element

The `<toggle>` element conditionally renders content based on a boolean value:

```tsx
function App(this: FC<{ show: boolean }>) {
  this.show = false;

  function toggle() {
    this.show = !this.show;
  }

  return (
    <div>
      <toggle value={this.show}>
        <h1>Welcome to mono-jsx!</h1>
      </toggle>

      <button onClick={toggle}>
        {this.computed(() => this.show ? "Hide" : "Show")}
      </button>
    </div>
  );
}
```

### `<switch>` element

The `<switch>` element renders different content based on a value. Elements with matching `slot` attributes are displayed when their value matches, otherwise default content is shown:

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

mono-jsx renders your `<html>` as a readable stream, allowing async components to render asynchronously. You can use `placeholder` to display a loading state while waiting for async components to render:

```jsx
async function Sleep({ ms }) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return <slot />;
}

export default {
  fetch: (req) => (
    <html>
      <h1>Welcome to mono-jsx!</h1>

      <Sleep ms={1000} placeholder={<p>Sleeping...</p>}>
        <p>After 1 second</p>
      </Sleep>
    </html>
  ),
};
```

You can set the `rendering` attribute to `"eager"` to force synchronous rendering (the `placeholder` will be ignored):

```jsx
async function Sleep({ ms }) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return <slot />;
}

export default {
  fetch: (req) => (
    <html>
      <h1>Welcome to mono-jsx!</h1>

      <Sleep ms={1000} rendering="eager">
        <p>After 1 second</p>
      </Sleep>
    </html>
  ),
};
```

## Using Context

You can use the `context` property in `this` to access context values in your components. The context is defined on the root `<html>` element:

```tsx
function Dash(this: FC<{}, { auth: { uuid: string; name: string } }>) {
  const { auth } = this.context;
  return (
    <div>
      <h1>Welcome back, {auth.name}!</h1>
      <p>Your UUID is {auth.uuid}</p>
    </div>
  );
}

export default {
  fetch: async (req) => {
    const auth = await doAuth(req);
    return (
      <html context={{ auth }} request={req}>
        {!auth && <p>Please Login</p>}
        {auth && <Dash />}
      </html>
    );
  },
};
```

## Accessing Request Info

You can access request information in components via the `request` property in `this` which is set on the root `<html>` element:

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

Add `status` or `headers` attributes to the root `<html>` element to customize the response:

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
