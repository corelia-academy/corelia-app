/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The learning app on this origin (default "/learn"). */
  readonly PUBLIC_APP_URL?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
