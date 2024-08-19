import { build, stop } from "https://deno.land/x/esbuild@v0.23.1/mod.js";

const start = performance.now();

async function buildPackageModule(entryPoint: string) {
  await build({
    entryPoints: [`./${entryPoint}.ts`],
    outfile: `./${entryPoint}.mjs`,
    format: "esm",
    target: "esnext",
    bundle: true,
    minify: false,
    external: ["mono-jsx", "node:*"],
  });
  return await Deno.lstat(`./${entryPoint}.mjs`);
}

for await (const { name, isFile } of Deno.readDirSync("./")) {
  if (isFile && name.endsWith(".ts") && name != "build.ts" && !name.endsWith(".test.ts")) {
    const entryPoint = name.replace(/\.ts$/, "");
    const { size } = await buildPackageModule(entryPoint);
    console.log(`- ${entryPoint}.mjs %c(${size.toLocaleString()} bytes)`, "color:grey");
  }
}

console.log("%cBuild complete! (%d ms)", "color:grey", performance.now() - start);
stop();
