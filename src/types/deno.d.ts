declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve?: (...args: unknown[]) => unknown;
};
