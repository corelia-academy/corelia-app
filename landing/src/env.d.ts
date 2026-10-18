/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_APP_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
