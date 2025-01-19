export interface RenderOptions {
  request?: Request;
  data?: Record<string, unknown>;
  status?: number;
  headers?: {
    [key: string]: string | undefined;
    contentSecurityPolicy?: string;
    cacheControl?: "public, max-age=31536000, immutable" | "public, max-age=0, must-revalidate" | (string & {});
    etag?: string;
    lastModified?: string;
    setCookie?: string;
  };
  rendering?: "eager";
}
