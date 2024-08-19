// deno-lint-ignore-file verbatim-module-syntax
/* @jsx h */
/* @jsxFrag Fragment */
import { assertEquals } from "jsr:@std/assert";
import { Fragment, h } from "mono-jsx";

declare global {
  namespace JSX {
    interface CustomCSSRules {
      rounded: "lg";
    }
    interface CustomElements {
      "foo-bar": {
        foo: string;
      };
    }
  }
}

Deno.test("[jsx] jsx.h", () => {
  const Hello = () => (
    <h1
      class={["heading", true && "title", { "h1": true }]}
      style={{
        color: "#232323",
        width: 100,
        rounded: "lg",
        ":focus": { color: "#000" },
        "@media (min-width: 640px)": {
          fontSize: 20,
        },
      }}
      title="Hello world"
      data-title="Hello world"
    >
      Hello world
    </h1>
  );
  assertEquals(
    <Hello route="/" />,
    {
      tag: Hello,
      props: {},
      route: "/",
    },
  );
  assertEquals(
    Hello(),
    {
      tag: "h1",
      props: {
        class: ["heading", true && "title", { "h1": true }],
        style: {
          color: "#232323",
          width: 100,
          rounded: "lg",
          ":focus": { color: "#000" },
          "@media (min-width: 640px)": {
            fontSize: 20,
          },
        },
        title: "Hello world",
        "data-title": "Hello world",
      },
      children: ["Hello world"],
    },
  );
});

Deno.test("[jsx] jsx.Fragment", () => {
  assertEquals(
    <>
      <h1>Hello world</h1>
    </>,
    {
      tag: Fragment,
      props: null,
      children: [{ tag: "h1", props: null, children: ["Hello world"] }],
    },
  );
  assertEquals(
    Fragment({ key: "akey", children: [<h1>Hello world</h1>] }),
    {
      tag: Symbol.for("jsx.Fragment"),
      props: null,
      children: [{ tag: "h1", props: null, children: ["Hello world"] }],
      key: "akey",
    },
  );
});

Deno.test("[jsx] Async component", () => {
  const Sleep = async ({ ms }: { ms: number }) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return <slot />;
  };

  assertEquals(
    <Sleep ms={1000} pending={<p>sleeping...</p>}>
      <h1>Hello world</h1>
    </Sleep>,
    {
      tag: Sleep,
      props: { ms: 1000 },
      pending: { tag: "p", props: null, children: ["sleeping..."] },
      children: [{ tag: "h1", props: null, children: ["Hello world"] }],
    },
  );
});

Deno.test("[jsx] Async generator component", () => {
  async function* Counter({ value }: { value: number }) {
    while (value-- > 0) {
      yield Promise.resolve(<div>{value}</div>);
    }
  }
  assertEquals(
    <Counter value={10} />,
    {
      tag: Counter,
      props: { value: 10 },
    },
  );
});

Deno.test("[jsx] Builtin components", () => {
  assertEquals(
    <cache key="hello" maxAge={86400} swr={3600}>
      <h1>Hello world</h1>
    </cache>,
    {
      tag: "cache",
      props: { maxAge: 86400, swr: 3600 },
      children: [{ tag: "h1", props: null, children: ["Hello world"] }],
      key: "hello",
    },
  );
});

Deno.test("[jsx] Routing", () => {
  assertEquals(
    <body>
      <nav>
        <a href="/" style={{ ":nav-active": { fontWeight: "bold" } }}>Home</a>
        <a href="/about" style={{ ":nav-active": { fontWeight: "bold" } }}>About</a>
      </nav>
      <div route="/">
        Home page
      </div>
      <div route="/about">
        About page
      </div>
    </body>,
    {
      tag: "body",
      props: null,
      children: [
        {
          tag: "nav",
          props: null,
          children: [
            {
              tag: "a",
              props: {
                href: "/",
                style: {
                  ":nav-active": { fontWeight: "bold" },
                },
              },
              children: ["Home"],
            },
            {
              tag: "a",
              props: {
                href: "/about",
                style: {
                  ":nav-active": { fontWeight: "bold" },
                },
              },
              children: ["About"],
            },
          ],
        },
        {
          tag: "div",
          props: {},
          children: ["Home page"],
          route: "/",
        },
        {
          tag: "div",
          props: {},
          children: ["About page"],
          route: "/about",
        },
      ],
    },
  );
});

Deno.test("[jsx] Custom elements", () => {
  JSX.customElements.define("foo-bar", () => <h1>Hello world</h1>);
  assertEquals(
    <foo-bar foo="bar" />,
    {
      tag: "foo-bar",
      props: { foo: "bar" },
    },
  );
});

Deno.test("[jsx] Tagged template components", () => {
  assertEquals(
    <style>{css`h1{ font-weight: bold; }`}</style>,
    {
      tag: "style",
      props: null,
      children: [{ tag: Symbol.for("jsx.Fragment"), props: null, innerHTML: "h1{ font-weight: bold; }" }],
    },
  );
  assertEquals(
    <script>{js`console.log("Hello world!")`}</script>,
    {
      tag: "script",
      props: null,
      children: [{ tag: Symbol.for("jsx.Fragment"), props: null, innerHTML: 'console.log("Hello world!")' }],
    },
  );
  assertEquals(
    <div>{html`<h1>Hello!</h1>`}</div>,
    {
      tag: "div",
      props: null,
      children: [{ tag: Symbol.for("jsx.Fragment"), props: null, innerHTML: "<h1>Hello!</h1>" }],
    },
  );
});

Deno.test("[jsx] Events", () => {
  const onclick = "console.log(event)";
  const onClick = (e: Event) => {
    console.log(e);
  };
  assertEquals(
    <button onclick={onclick} onClick={onClick} />,
    {
      tag: "button",
      props: {
        onClick: onClick,
        onclick: onclick,
      },
    },
  );
});
