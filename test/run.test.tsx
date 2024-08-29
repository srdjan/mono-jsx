/* @jsxImportSource mono-jsx */
import { assert, assertEquals } from "jsr:@std/assert";
import puppeteer from "npm:puppeteer-core@23.1.1";
import chrome from "npm:puppeteer-chromium-resolver@23.0.0";

let jsxIndex = 0;
let jsxMap: Map<string, JSX.Element> = new Map();

const ac = new AbortController();
const browser = await puppeteer.launch({
  executablePath: (await chrome()).executablePath,
  args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-sync", "--disable-background-networking"],
});

Deno.serve({
  port: 8687,
  signal: ac.signal,
  onListen: () => {},
}, (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/favicon.ico") {
    return new Response(null, { status: 404 });
  }
  return (
    <html request={request}>
      <head>
        <title>test</title>
      </head>
      <body>{jsxMap.get(url.pathname)}</body>
    </html>
  );
});

function addJSX(jsx: JSX.Element) {
  const pathname = `/jsx_${jsxIndex++}`;
  jsxMap.set(pathname, jsx);
  return `http://localhost:8687${pathname}`;
}

declare global {
  interface State {
    text: string;
    counter: number;
  }
}

Deno.test("[run] using state", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testUrl = addJSX(
    <div>
      <h1>
        <state name="text" />
      </h1>
      <button
        onClick={() => {
          state.text = "Hello world!";
        }}
      />
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

  await page.close({ runBeforeUnload: true });
});

Deno.test("[run] using state(counter)", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testUrl = addJSX(
    <div>
      <button
        onClick={() => {
          state.counter--;
        }}
      />
      <strong>
        <state name="counter" value={0} />
      </strong>
      <button
        onClick={() => {
          state.counter++;
        }}
      />
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

  await page.close({ runBeforeUnload: true });
});

Deno.test("[run] on 'mount'", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const testUrl = addJSX(
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
  assertEquals(await div.evaluate((el: HTMLElement) => el.childElementCount), 1);

  const h1 = await page.$("div > h1")!;
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello world!");

  await page.close({ runBeforeUnload: true });
});

Deno.test("[run] suspense", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const Sleep = async ({ ms }: { ms: number }) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return <slot />;
  };
  const Slogan = () => Promise.resolve(<h2>Building User Interfaces.</h2>);
  const testUrl = addJSX(
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

  await page.close({ runBeforeUnload: true });
});
