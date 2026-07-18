export {};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: Record<string, unknown>;
      };
    };
  }
}
