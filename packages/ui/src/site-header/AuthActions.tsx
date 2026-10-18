import type { ReactNode } from "react";

import type { SiteHeaderLinkProps } from "./SiteHeader";
import type { SiteSessionUser } from "./session";

export type AuthActionsProps = {
  /** `undefined` while the session is unknown (renders a placeholder of the same size). */
  user: SiteSessionUser | null | undefined;
  signInHref: string;
  signUpHref: string;
  appHref: string;
  labels: { signIn: string; signUp: string; goToApp: string };
  renderLink?: (props: SiteHeaderLinkProps) => ReactNode;
  /** Stack full-width buttons (mobile drawer). */
  stacked?: boolean;
};

const defaultLink = ({ children, ...props }: SiteHeaderLinkProps) => <a {...props}>{children}</a>;

function initial(user: SiteSessionUser): string {
  return (user.name ?? user.email ?? "U").charAt(0).toUpperCase();
}

/** Guest: "Log in" + "Sign up". Signed in: avatar + "Go to learning". The box keeps one size to avoid layout shift. */
export function AuthActions({ user, signInHref, signUpHref, appHref, labels, renderLink = defaultLink, stacked = false }: AuthActionsProps) {
  const className = stacked ? "csh-auth csh-auth-stacked" : "csh-auth";
  if (user === undefined) return <div className={className} aria-hidden data-pending />;
  if (user) {
    return (
      <div className={className}>
        {renderLink({
          href: appHref,
          className: "csh-button csh-button-primary",
          children: (
            <>
              {user.avatarUrl
                ? <img className="csh-avatar" src={user.avatarUrl} alt="" width={24} height={24} referrerPolicy="no-referrer" />
                : <span className="csh-avatar" aria-hidden>{initial(user)}</span>}
              <span>{labels.goToApp}</span>
            </>
          ),
        })}
      </div>
    );
  }
  return (
    <div className={className}>
      {renderLink({ href: signInHref, className: "csh-button csh-button-ghost", children: labels.signIn })}
      {renderLink({ href: signUpHref, className: "csh-button csh-button-primary", children: labels.signUp })}
    </div>
  );
}
