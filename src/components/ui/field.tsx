import * as React from "react";
import { cn } from "@/lib/utils";

export type FieldControlState = {
  currentLength?: number;
  maxLength?: number;
  hasSelectedTags?: boolean;
};

export type FieldContextValue = {
  controlId: string;
  hintId: string;
  errorId: string;
  counterId: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required: boolean;
  disabled: boolean;
  reportControlState: (state: FieldControlState) => void;
};

export const FIELD_CONTROL_MARKER: unique symbol = Symbol(
  "corelia.field-control",
);

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function FieldContextConsumer({
  children,
}: {
  children: (value: FieldContextValue | null) => React.ReactNode;
}) {
  const value = React.useContext(FieldContext);
  return children(value);
}

export function FieldContextReset({ children }: { children: React.ReactNode }) {
  return <FieldContext.Provider value={null}>{children}</FieldContext.Provider>;
}

type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  controlId?: string;
};

type FieldControlChildProps = {
  id?: string;
  maxLength?: number;
  value?: unknown;
  defaultValue?: unknown;
  variant?: string;
  selectedTagValues?: readonly string[];
};

function findFieldControlChild(
  children: React.ReactNode,
): React.ReactElement<FieldControlChildProps> | undefined {
  let controlChild: React.ReactElement<FieldControlChildProps> | undefined;

  React.Children.forEach(children, (child) => {
    if (controlChild || !React.isValidElement(child)) return;

    const isFieldControl =
      typeof child.type !== "string" &&
      (child.type as unknown as {
        [FIELD_CONTROL_MARKER]?: boolean;
      })[FIELD_CONTROL_MARKER] === true;

    if (isFieldControl) {
      controlChild = child as React.ReactElement<FieldControlChildProps>;
      return;
    }

    const nestedChildren = (
      child.props as { children?: React.ReactNode }
    ).children;
    controlChild = findFieldControlChild(nestedChildren);
  });

  return controlChild;
}

function getInitialControlState(
  controlChild: React.ReactElement<FieldControlChildProps> | undefined,
): FieldControlState | undefined {
  if (!controlChild) return undefined;

  const { defaultValue, maxLength, selectedTagValues, value, variant } =
    controlChild.props;
  const initialValue =
    value !== null && value !== undefined ? value : defaultValue;
  const hasSelectedTags =
    variant === "tags" && (selectedTagValues?.length ?? 0) > 0;
  const hasCounter = maxLength !== null && maxLength !== undefined;

  if (!hasCounter && !hasSelectedTags) return undefined;

  return {
    currentLength: String(initialValue ?? "").length,
    maxLength: hasCounter ? maxLength : undefined,
    hasSelectedTags,
  };
}

const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-group"
    className={cn("flex flex-col gap-3xl", className)}
    {...props}
  />
));
FieldGroup.displayName = "FieldGroup";

const Field = React.forwardRef<
  HTMLDivElement,
  FieldProps
>(({ className, label, hint, error, required = false, disabled = false, controlId: explicitControlId, children, ...props }, ref) => {
  const generatedControlId = React.useId();
  const controlChild = findFieldControlChild(children);
  const visibleLabel = typeof label === "boolean" ? undefined : label;
  const visibleHint = typeof hint === "boolean" ? undefined : hint;
  const visibleError = typeof error === "boolean" ? undefined : error;
  const [controlState, setControlState] = React.useState<
    FieldControlState | undefined
  >(() => getInitialControlState(controlChild));
  const childControlId = controlChild?.props.id;
  const controlId = explicitControlId ?? childControlId ?? generatedControlId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const counterId = `${controlId}-counter`;
  const hasLabel = visibleLabel !== null && visibleLabel !== undefined;
  const hasHint = visibleHint !== null && visibleHint !== undefined;
  const hasError = visibleError !== null && visibleError !== undefined;
  const hasVisibleHint = hasHint && !hasError && !controlState?.hasSelectedTags;
  const hasCounter =
    controlState?.maxLength !== null && controlState?.maxLength !== undefined;
  const childHasMaxLength =
    controlChild?.props.maxLength !== null &&
    controlChild?.props.maxLength !== undefined;
  const hasFieldPresentation =
    hasLabel ||
    hasHint ||
    hasError ||
    required ||
    disabled ||
    explicitControlId !== undefined ||
    childHasMaxLength;

  const reportControlState = React.useCallback(
    (nextState: FieldControlState) => {
      setControlState((currentState) => {
        if (
          currentState?.currentLength === nextState.currentLength &&
          currentState?.maxLength === nextState.maxLength &&
          currentState?.hasSelectedTags === nextState.hasSelectedTags
        ) {
          return currentState;
        }

        return nextState;
      });
    },
    [],
  );

  const contextValue = React.useMemo<FieldContextValue>(
    () => ({
      controlId,
      hintId,
      errorId,
      counterId,
      label: visibleLabel,
      hint: visibleHint,
      error: visibleError,
      required,
      disabled,
      reportControlState,
    }),
    [
      controlId,
      hintId,
      errorId,
      counterId,
      visibleLabel,
      visibleHint,
      visibleError,
      required,
      disabled,
      reportControlState,
    ],
  );

  return (
    <FieldContext.Provider value={hasFieldPresentation ? contextValue : null}>
      <div
        ref={ref}
        data-slot="field"
        data-disabled={disabled || undefined}
        className={cn(
          "flex flex-col gap-md",
          hasFieldPresentation && "w-full",
          className,
        )}
        {...props}
      >
        {hasLabel ? (
          <FieldLabel
            htmlFor={controlId}
            className={cn(
              "leading-[1.4] text-foreground-subtle",
              disabled && "text-input-field-disabled-foreground",
            )}
          >
            {visibleLabel}
            {required ? (
              <span aria-hidden="true" className="ml-xs">
                *
              </span>
            ) : null}
          </FieldLabel>
        ) : null}

        {children}

        {hasVisibleHint || hasError || hasCounter ? (
          <div className="flex min-w-0 items-start justify-between gap-md">
            <div className="flex min-w-0 flex-col gap-xs">
              {hasVisibleHint ? (
                <FieldDescription
                  id={hintId}
                  className={cn(
                    "text-body-medium leading-[1.4] tracking-[0.02em]",
                    disabled
                      ? "text-input-field-disabled-foreground"
                      : "text-foreground-tertiary",
                  )}
                >
                  {visibleHint}
                </FieldDescription>
              ) : null}
              {hasError ? (
                <FieldDescription
                  id={errorId}
                  className="text-body-medium leading-[1.4] tracking-[0.02em] text-input-field-error"
                >
                  {visibleError}
                </FieldDescription>
              ) : null}
            </div>
            {hasCounter ? (
              <FieldDescription
                id={counterId}
                className={cn(
                  "shrink-0 leading-[1.4] tracking-[0.02em]",
                  disabled
                    ? "text-input-field-disabled-foreground"
                    : "text-foreground-tertiary",
                )}
              >
                {controlState?.currentLength ?? 0}/{controlState?.maxLength}
              </FieldDescription>
            ) : null}
          </div>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
});
Field.displayName = "Field";

const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentProps<"label">
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    data-slot="field-label"
    className={cn("text-label-medium font-body", className)}
    {...props}
  />
));
FieldLabel.displayName = "FieldLabel";

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="field-description"
    className={cn("text-body-small font-body text-foreground-muted", className)}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

const FieldSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-separator"
    role="separator"
    className={cn("relative flex items-center gap-xl", className)}
    {...props}
  >
    <div className="flex-1 border-t border-border" />
    {children != null && (
      <span
        data-slot="field-separator-content"
        className="text-body-small font-body text-foreground-muted"
      >
        {children}
      </span>
    )}
    <div className="flex-1 border-t border-border" />
  </div>
));
FieldSeparator.displayName = "FieldSeparator";

export {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
};
