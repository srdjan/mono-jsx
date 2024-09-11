export interface RenderOptions {
  request?: Request;
  headers?: {
    [key: string]: string | undefined;
    contentSecurityPolicy?: string;
    cacheControl?: "public, max-age=31536000, immutable" | "private, max-age=0, must-revalidate" | (string & {});
    etag?: string;
    lastModified?: string;
    setCookie?: string;
  };
}
