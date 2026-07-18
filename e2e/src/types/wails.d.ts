// Wails injects Go-bound methods onto `window.go.main.App` at runtime. These
// are only reachable inside page.evaluate() (browser context), so a loose but
// non-`any` shape is enough to keep the e2e tests type-safe.
export {};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: Record<string, (...args: unknown[]) => Promise<unknown>>;
      };
    };
  }
}
