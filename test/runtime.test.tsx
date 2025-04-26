import { assert, assertEquals } from "jsr:@std/assert";
import puppeteer from "npm:puppeteer-core@23.1.1";
import chrome from "npm:puppeteer-chromium-resolver@23.0.0";

let routeIndex = 0;
let testRoutes: Map<string, JSX.Element> = new Map();

Deno.serve({
  port: 8687,
  onListen: () => {},
}, (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/favicon.ico") {
    return new Response(null, { status: 404 });
  }
  return (
    <html request={request}>
      <head>
        <title>Test</title>
      </head>
      <body>{testRoutes.get(url.pathname)}</body>
    </html>
  );
});

const browser = await puppeteer.launch({
  executablePath: (await chrome()).executablePath,
  args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-sync", "--disable-background-networking"],
});

function addTestPage(page: JSX.Element) {
  const pathname = `/test_${routeIndex++}`;
  testRoutes.set(pathname, page);
  return `http://localhost:8687${pathname}`;
}

Deno.test("[run] using state(text)", { sanitizeResources: false, sanitizeOps: false }, async () => {
  function Hello(this: FC<{ text: string }>, props: { text: string }) {
    this.text = props.text;
    return (
      <div>
        <h1>{this.text}</h1>
        <button type="button" onClick={() => this.text = "Clicked!"}>
          Click me
        </button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<Hello text="Hello, world!" />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello, world!");

  const button = await page.$("div button")!;
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Clicked!");

  await page.close();
});

Deno.test("[runtime] using state(counter)", { sanitizeResources: false, sanitizeOps: false }, async () => {
  function Counter(this: FC<{ count: number }>, props: { initialValue: number }) {
    this.count = props.initialValue;
    return (
      <div>
        <button type="button" onClick={() => this.count--} />
        <strong>{this.count}</strong>
        <button type="button" onClick={() => this.count++} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<Counter initialValue={0} />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const strong = await page.$("div strong")!;
  assert(strong);
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "0");

  const buttons = await page.$$("div button");
  assertEquals(buttons.length, 2);

  // Click the increment button for 3 times
  for (let i = 0; i < 3; i++) {
    await buttons[1].click();
  }
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "3");

  // Click the decrement button for 5 times
  for (let i = 0; i < 5; i++) {
    await buttons[0].click();
  }
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "-2");

  await page.close();
});

Deno.test("[runtime] using computed state", { sanitizeResources: false, sanitizeOps: false }, async () => {
  function FooBar(this: FC<{ foo: string; bar: string }>) {
    this.foo = "foo";
    this.bar = "bar";
    return (
      <div>
        <h1>{this.computed(() => `${this.foo}${this.bar}!`)}</h1>
        <button type="button" onClick={() => this.bar = "bar2000"} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<FooBar />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.innerText), "foobar!");

  const button = await page.$("div button")!;
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "foobar2000!");

  await page.close();
});

Deno.test("[runtime] using computed class name", { sanitizeResources: false, sanitizeOps: false }, async () => {
  function FooBar(this: FC<{ foo: string; bar: string }>) {
    this.foo = "foo";
    this.bar = "bar";
    return (
      <div>
        <h1 class={this.computed(() => [this.foo, this.bar])} />
        <button type="button" onClick={() => this.bar = "bar2000"} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<FooBar />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.className), "foo bar");

  const button = await page.$("div button")!;
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.className), "foo bar2000");

  await page.close();
});

Deno.test("[runtime] <toggle> element", { sanitizeResources: false, sanitizeOps: false }, async () => {
  function Toggle(this: FC<{ show: boolean }>) {
    this.show = false;
    return (
      <div>
        <toggle value={this.show}>
          <h1>Hello world!</h1>
        </toggle>
        <button type="button" onClick={() => this.show = !this.show}>
          Show
        </button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<Toggle />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("div h1");
  assert(!div);

  const button = await page.$("div button")!;
  assert(button);
  await button.click();

  let h1 = await page.$("div h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello world!");

  await button.click();
  h1 = await page.$("div h1");
  assert(!h1);

  await page.close();
});

Deno.test("[runtime] <switch> element", { sanitizeResources: false, sanitizeOps: false }, async () => {
  function Switch(this: FC<{ lang: string }>) {
    this.lang = "emoji";
    return (
      <div>
        <switch value={this.lang}>
          <h1 slot="en">Hello, world!</h1>
          <h1 slot="zh">你好，世界！</h1>
          <h1>✋🌎❗️</h1>
        </switch>
        <button type="button" onClick={() => this.lang = "en"}>
          English
        </button>
        <button type="button" onClick={() => this.lang = "zh"}>
          中
        </button>
        <button type="button" onClick={() => this.lang = "emoji"}>
          emoji
        </button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<Switch />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  assertEquals((await page.$$("div h1")).length, 1);

  let h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "✋🌎❗️");

  const buttons = await page.$$("div button");
  assertEquals(buttons.length, 3);

  await buttons[0].click();
  h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello, world!");

  await buttons[1].click();
  h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "你好，世界！");

  await buttons[2].click();
  h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "✋🌎❗️");

  await page.close();
});

Deno.test("[runtime] 'mount' handler", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testPageUrl = addTestPage(
    <div
      onMount={e => {
        e.target.innerHTML = "<h1>Hello world!</h1>";
      }}
    />,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("div")!;
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.innerHTML), "<h1>Hello world!</h1>");

  await page.close();
});

Deno.test("[runtime] 'action' handler", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testPageUrl = addTestPage(
    <>
      <p></p>
      <form
        action={data => {
          const p: HTMLElement = document.querySelector("p")!;
          p.textContent = data.get("name")! as string;
        }}
      >
        <input type="hidden" name="name" value="Hello world!" />
        <button type="submit">Submit</button>
      </form>
    </>,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const p = await page.$("p")!;
  assert(p);
  assertEquals(await p.evaluate((el: HTMLElement) => el.textContent), "");

  const button = await page.$("button")!;
  assert(button);
  await button.click();

  assertEquals(await p.evaluate((el: HTMLElement) => el.textContent), "Hello world!");

  await page.close();
});

Deno.test("[runtime] suspense", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const Sleep = async ({ ms }: { ms: number }) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return <slot />;
  };
  const Slogan = () => Promise.resolve(<h2>Building User Interfaces.</h2>);
  const testPageUrl = addTestPage(
    <div>
      <Sleep ms={100} placeholder={<p>Loading...</p>}>
        <h1>Hello world!</h1>
        <Slogan />
      </Sleep>
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("div")!;
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.childElementCount), 2);

  const p = await page.$("div > p");
  assert(!p);

  const h1 = await page.$("div > h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello world!");

  const h2 = await page.$("div > h2")!;
  assert(h2);
  assertEquals(await h2.evaluate((el: HTMLElement) => el.textContent), "Building User Interfaces.");

  await page.close();
});
