/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** hCaptcha site key (public). Required on the client when Supabase Auth CAPTCHA is enabled. */
  readonly VITE_HCAPTCHA_SITEKEY?: string;
  /** When "true", enables console performance marks for fetch/auth flows (staging debugging). */
  readonly VITE_PERF_DEBUG?: string;
}
