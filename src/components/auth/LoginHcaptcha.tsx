import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { cn } from "@/lib/utils";

type LoginHcaptchaProps = {
  sitekey: string;
  onToken: (token: string | null) => void;
  className?: string;
};

/**
 * hCaptcha widget for Supabase Auth; ref exposes `resetCaptcha()`.
 * @see https://supabase.com/docs/guides/auth/auth-captcha
 */
export const LoginHcaptcha = forwardRef<
  InstanceType<typeof HCaptcha>,
  LoginHcaptchaProps
>(
  function LoginHcaptcha({ sitekey, onToken, className }, ref) {
    return (
      <div className={cn("flex justify-center", className)}>
        <HCaptcha
          ref={ref}
          sitekey={sitekey}
          size="normal"
          onVerify={(token) => {
            onToken(token);
          }}
          onExpire={() => {
            onToken(null);
          }}
        />
      </div>
    );
  },
);
