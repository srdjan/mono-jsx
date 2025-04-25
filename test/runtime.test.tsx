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

function addTestRoute(content: JSX.Element) {
  const pathname = `/test_${routeIndex++}`;
  testRoutes.set(pathname, content);
  return `http://localhost:8687${pathname}`;
}

declare global {
  interface State {
    text: string;
    foo: string;
    bar: string;
    counter: number;
    lang: string;
  }
}

Deno.test("[run] using state(text)", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testUrl = addTestRoute(
    <div>
      <h1>{$state.text}</h1>
      <button type="button" onClick={() => $state.text = "Hello world!"} />
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

  const h1 = await page.$("div h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "");

  const button = await page.$("div button")!;
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello world!");

  await page.close();
});

Deno.test("[runtime] using state(counter)", { sanitizeResources: false, sanitizeOps: false }, async () => {
  $state.counter = 0;

  const testUrl = addTestRoute(
    <div>
      <button type="button" onClick={() => $state.counter--} />
      <strong>{$state.counter}</strong>
      <button type="button" onClick={() => $state.counter++} />
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

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

  // Click the decrement button for 3 times
  for (let i = 0; i < 3; i++) {
    await buttons[0].click();
  }
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "0");

  await page.close();
});

Deno.test("[runtime] using computed state", { sanitizeResources: false, sanitizeOps: false }, async () => {
  $state.foo = "foo";
  $state.bar = "bar";
  const testUrl = addTestRoute(
    <div>
      <h1>{$computed(() => `${$state.foo}${$state.bar}!`)}</h1>
      <button type="button" onClick={() => $state.bar = "BAR"} />
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

  const h1 = await page.$("div h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.innerText), "foobar!");

  const button = await page.$("div button")!;
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "fooBAR!");

  await page.close();
});

Deno.test("[runtime] using computed class name", { sanitizeResources: false, sanitizeOps: false }, async () => {
  $state.foo = "foo";
  $state.bar = "bar";
  const testUrl = addTestRoute(
    <div>
      <h1 class={$computed(() => [$state.foo, $state.bar])} />
      <button type="button" onClick={() => $state.bar = "BAR"} />
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

  const h1 = await page.$("div h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.className), "foo bar");

  const button = await page.$("div button")!;
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.className), "foo BAR");

  await page.close();
});

Deno.test("[runtime] <toggle> element", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testUrl = addTestRoute(
    <div>
      <toggle value={$state.show}>
        <h1>Hello world!</h1>
      </toggle>
      <button type="button" onClick={() => $state.show = !$state.show}>
        Show
      </button>
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

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
  const testUrl = addTestRoute(
    <div>
      <switch value={$state.lang}>
        <h1 slot="en">Hello, world!</h1>
        <h1 slot="zh">你好，世界！</h1>
        <h1>✋🌎❗️</h1>
      </switch>
      <button type="button" onClick={() => $state.lang = "en"}>
        English
      </button>
      <button type="button" onClick={() => $state.lang = "zh"}>
        中
      </button>
      <button type="button" onClick={() => $state.lang = "emoji"}>
        emoji
      </button>
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

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
  const testUrl = addTestRoute(
    <div
      onMount={e => {
        e.target.innerHTML = "<h1>Hello world!</h1>";
      }}
    />,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

  const div = await page.$("div")!;
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.innerHTML), "<h1>Hello world!</h1>");

  await page.close();
});

Deno.test("[runtime] 'action' handler", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testUrl = addTestRoute(
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
  await page.goto(testUrl);

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
  const testUrl = addTestRoute(
    <div>
      <Sleep ms={100} placeholder={<p>Loading...</p>}>
        <h1>Hello world!</h1>
        <Slogan />
      </Sleep>
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testUrl);

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
