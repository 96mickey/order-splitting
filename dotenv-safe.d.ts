/** Minimal typings; package ships without its own .d.ts */
declare module 'dotenv-safe' {
  export function config(options?: Record<string, unknown>): unknown;
}
