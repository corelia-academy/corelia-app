import type { ReactNode } from "react";

import { ArrowLeft, ArrowRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const buttonTypes = [
  { value: "cta", label: "CTA" },
  { value: "destructive", label: "Destructive" },
] as const;

const hierarchyOptions = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "tertiary", label: "Tertiary" },
] as const;

const sizeOptions = [
  { value: "large", label: "Large" },
  { value: "medium", label: "Medium" },
  { value: "small", label: "Small" },
  { value: "xsmall", label: "XSmall" },
] as const;

const floatingSizeOptions = [
  { value: "large", label: "Large" },
  { value: "medium", label: "Medium" },
] as const;

const leadingIcon = <ArrowLeft aria-hidden="true" />;
const trailingIcon = <ArrowRight aria-hidden="true" />;

function ButtonShowcasePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <h3 className="text-heading-small font-display">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function ButtonStateMatrix({
  variant,
  iconOnly = false,
}: {
  variant: (typeof buttonTypes)[number]["value"];
  iconOnly?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-label-medium">
        {iconOnly ? "Icon only" : "With label"}
      </h4>
      <div className="space-y-4">
        {hierarchyOptions.map(({ value: hierarchy, label: hierarchyLabel }) => {
          const renderButton = (
            size: (typeof sizeOptions)[number]["value"],
            disabled: boolean,
          ) => (
            <Button
              type="button"
              variant={variant}
              hierarchy={hierarchy}
              size={size}
              iconOnly={iconOnly}
              leadingIcon={iconOnly ? undefined : leadingIcon}
              trailingIcon={iconOnly ? undefined : trailingIcon}
              aria-label={iconOnly ? "Add item" : undefined}
              disabled={disabled}
            >
              {iconOnly ? <Plus aria-hidden="true" /> : "Run action"}
            </Button>
          );

          return (
            <div key={hierarchy} className="space-y-2">
              <span className="text-body-small text-foreground-muted">
                {hierarchyLabel}
              </span>
              <div className="grid grid-cols-4 gap-x-lg gap-y-sm">
                {sizeOptions.map(({ value: size, label: sizeLabel }) => (
                  <span
                    key={`size-${size}`}
                    className="text-body-small text-foreground-muted"
                  >
                    {sizeLabel}
                  </span>
                ))}
                {sizeOptions.map(({ value: size }) => (
                  <div key={`enabled-${size}`} className="flex items-center">
                    {renderButton(size, false)}
                  </div>
                ))}
                <div className="col-span-4 grid grid-cols-4 gap-x-lg gap-y-md">
                  {sizeOptions.map(({ value: size }) => (
                    <span
                      key={`disabled-label-${size}`}
                      className="text-body-small text-foreground-muted"
                    >
                      Disabled
                    </span>
                  ))}
                  {sizeOptions.map(({ value: size }) => (
                    <div
                      key={`disabled-${size}`}
                      className="flex items-center"
                    >
                      {renderButton(size, true)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminButtonComponentPage() {
  return (
    <div className="space-y-6">
      {buttonTypes.map(({ value: variant, label }) => (
        <ButtonShowcasePanel key={variant} title={label}>
          <div className="space-y-6">
            <ButtonStateMatrix variant={variant} />
            <ButtonStateMatrix variant={variant} iconOnly />

            {variant === "cta" && (
              <section className="space-y-3 border-t border-border-subtle pt-lg">
                <h4 className="text-label-medium">Form composition</h4>
                <form
                  className="grid gap-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <Field label="Email address" required>
                    <Input
                      type="email"
                      placeholder="Enter an email address"
                      required
                    />
                  </Field>
                  <Button
                    type="submit"
                    variant="cta"
                    hierarchy="primary"
                    size="medium"
                    trailingIcon={trailingIcon}
                  >
                    Submit form
                  </Button>
                </form>
              </section>
            )}
          </div>
        </ButtonShowcasePanel>
      ))}

      <ButtonShowcasePanel title="Floating">
        <div className="flex flex-wrap items-center gap-xl">
          {floatingSizeOptions.map(({ value: size, label }) => (
            <div key={size} className="flex flex-col gap-md">
              <span className="text-body-small text-foreground-muted">
                {label}
              </span>
              <div className="flex flex-wrap items-center gap-md">
                <Button
                  type="button"
                  variant="floating"
                  size={size}
                  leadingIcon={leadingIcon}
                  trailingIcon={trailingIcon}
                >
                  Run action
                </Button>
                <Button
                  type="button"
                  variant="floating"
                  size={size}
                  leadingIcon={leadingIcon}
                  trailingIcon={trailingIcon}
                  disabled
                >
                  Run action
                </Button>
                <Button
                  type="button"
                  variant="floating"
                  size={size}
                  iconOnly
                  aria-label="Open quick action"
                >
                  <Plus aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="floating"
                  size={size}
                  iconOnly
                  aria-label="Open quick action"
                  disabled
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ButtonShowcasePanel>
    </div>
  );
}
