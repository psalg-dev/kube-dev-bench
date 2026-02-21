export {};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          SetPreferredNamespaces?: (_namespaces: string[]) => Promise<void>;
        };
      };
    };
  }
}
