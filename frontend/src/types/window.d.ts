export {};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          SetPreferredNamespaces?: (namespaces: string[]) => Promise<void>;
        };
      };
    };
  }
}
