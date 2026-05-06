/** Public site key; empty when unset (CAPTCHA disabled in this build). */
export function hcaptchaSiteKey(): string {
  return import.meta.env.VITE_HCAPTCHA_SITEKEY?.trim() ?? "";
}

export function isHcaptchaConfigured(): boolean {
  return hcaptchaSiteKey().length > 0;
}
