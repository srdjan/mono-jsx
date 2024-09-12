// deno JSX transform
// https://deno.com/blog/v1.38#fastest-jsx-transform

// export async function jsxTemplate(
//   strings: string[],
//   ...values: unknown[]
// ): Promise<string> {
//   return "";
// }
// export function jsxAttr(name: string, value: unknown): string {
//   return "";
// }
// export async function jsxEscape(content: ChildType): Promise<string> {
//   return "";
// }

export * from "./jsx-runtime.ts";
