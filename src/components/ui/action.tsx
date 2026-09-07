import type { ReactNode } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const actionVariants = cva(
    "group/action relative flex min-w-0 w-full items-center border border-transparent text-left outline-none transition-[background-color,color,border-radius] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed",
    {
        variants: {
            variant: {
                default:
                    "rounded-[6px] text-foreground rounded-xl ",
                destructive:
                    "rounded-[6px] text-destructive rounded-xl ",
            },
            size: {
                large: "min-h-[60px] gap-3 px-3",
                small: "min-h-[50px] gap-3 px-2.5",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "large",
        },
    },
);

type ActionProps = Omit<ButtonPrimitive.Props, "children"> &
    VariantProps<typeof actionVariants> & {
        icon: ReactNode;
        label: ReactNode;
        supportingText?: ReactNode;
    };

function Action({
    className,
    variant = "default",
    size = "large",
    icon,
    label,
    supportingText,
    disabled = false,
    ...props
}: ActionProps) {
    const nextIconSrc = disabled
        ? "/icons/action/next-disabled.svg"
        : "/icons/action/next.svg";

    return (
        <ButtonPrimitive
            data-slot="action"
            data-variant={variant}
            data-size={size}
            disabled={disabled}
            className={cn(actionVariants({ variant, size, className }))}
            {...props}
        >
            <span
                className={cn(
                    "flex shrink-0 items-center justify-center",
                    size === "large" ? "size-6" : "size-5",
                    variant === "destructive"
                        ? "text-destructive"
                        : "text-current",
                    disabled && "text-foreground-subtle",
                    "[&_svg]:size-full",
                )}
            >
                {icon}
            </span>

            <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span
                    className={cn(
                        "block truncate font-medium",
                        size === "large"
                            ? "text-base leading-4"
                            : "text-sm leading-[14px]",
                        disabled && "text-foreground-subtle",
                    )}
                >
                    {label}
                </span>

                {supportingText ? (
                    <span
                        className={cn(
                            "block truncate text-foreground-muted",
                            size === "large"
                                ? "mt-1.5 text-sm leading-[18px]"
                                : "mt-1 text-xs leading-[14px]",
                            disabled && "text-foreground-subtle",
                        )}
                    >
                        {supportingText}
                    </span>
                ) : null}
            </span>

            <img
                src={nextIconSrc}
                alt=""
                aria-hidden="true"
                className="size-4 shrink-0"
            />
        </ButtonPrimitive>
    );
}

export { Action };
