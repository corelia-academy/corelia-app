import type { ReactNode } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const actionVariants = cva(
    // Shared layout scope (phạm vi layout dùng chung cho mọi Action).
    "group/action relative flex min-w-0 w-full items-center border border-transparent text-left outline-none transition-[background-color,color,border-radius] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:pointer-events-none data-disabled:cursor-not-allowed",
    {
        variants: {
            // Type scope (phạm vi loại hành động).
            variant: {
                // Normal action (hành động thông thường).
                default: "text-action-text",

                // Risky action (hành động nguy hiểm hoặc cần xác nhận).
                destructive: "text-action-destructive",
            },

            // Size scope (phạm vi kích thước). Default radius = 6px theo Figma.
            size: {
                // Large Action (Action lớn): 60px theo Figma.
                large: "min-h-[60px] gap-lg rounded-xl px-lg py-2md",

                // Small Action (Action nhỏ): 50px theo Figma.
                small: "min-h-[50px] gap-lg rounded-lg px-2md py-md",
            },

            // Business active scope (phạm vi item đang được chọn).
            isActive: {
                true: "",
                false: "",
            },
        },
        compoundVariants: [
            // Default + Large + inactive (loại thường + lớn + chưa được chọn):
            // hover (rê chuột) = action-hover.
            {
                variant: "default",
                size: "large",
                isActive: false,
                class: "hover:bg-action-hover hover:rounded-xl",
            },

            // Default + Small + inactive (loại thường + nhỏ + chưa được chọn):
            // hover (rê chuột) = action-hover.
            {
                variant: "default",
                size: "small",
                isActive: false,
                class: "hover:bg-action-hover hover:rounded-lg",
            },

            // Destructive + Large + inactive (nguy hiểm + lớn + chưa được chọn):
            // hover (rê chuột) = action-hover.
            {
                variant: "destructive",
                size: "large",
                isActive: false,
                class: "hover:bg-action-hover hover:rounded-xl",
            },

            // Destructive + Small + inactive (nguy hiểm + nhỏ + chưa được chọn):
            // hover (rê chuột) = action-hover.
            {
                variant: "destructive",
                size: "small",
                isActive: false,
                class: "hover:bg-action-hover hover:rounded-lg",
            },

            // Destructive + Small (nguy hiểm + nhỏ) có chiều cao 48px theo Figma.
            {
                variant: "destructive",
                size: "small",
                class: "min-h-[48px]",
            },

            // isActive=true: giữ màu đang chọn khi hover (rê chuột).
            // Nhờ vậy state dùng chung của Action không đổi màu item active.
            {
                variant: "default",
                isActive: true,
                class: "bg-blue-900 text-action-text data-[active=true]:hover:bg-blue-900 data-[active=true]:hover:text-action-text",
            },
            {
                variant: "destructive",
                isActive: true,
                class: "bg-error-700 text-action-text data-[active=true]:hover:bg-error-700 data-[active=true]:hover:text-action-text",
            },
        ],
        defaultVariants: {
            variant: "default",
            size: "large",
            isActive: false,
        },
    },
);

type ActionProps = Omit<ButtonPrimitive.Props, "children"> &
    VariantProps<typeof actionVariants> & {
        // Optional content slots (các vùng nội dung không bắt buộc).
        icon?: ReactNode;

        // Required accessible label (label bắt buộc để định danh Action).
        label: ReactNode;

        supportingText?: ReactNode;
        dateTime?: ReactNode;
        badge?: ReactNode;
        trailingGroup?: ReactNode;
        showTrailingIcon?: boolean;
        isActive?: boolean;

        // Toggle active visual state (bật/tắt hiển thị trạng thái đang chọn).
        showActive?: boolean;

        // Optional visual override: use the active color while hovered
        // (tùy chọn hiển thị: dùng màu active khi rê chuột, không đổi business state).
        hoverAsActive?: boolean;

        // Toggle the transient pressed state (bật/tắt trạng thái đang nhấn).
        // Opt-in only: callers enable it explicitly when needed.
        showPressed?: boolean;
    };

function Action({
    className,
    variant = "default",
    size = "large",
    icon,
    label,
    supportingText,
    dateTime,
    badge,
    trailingGroup,
    showTrailingIcon = false,
    isActive = false,
    showActive = true,
    hoverAsActive = false,
    showPressed = false,
    disabled = false,
    ...props
}: ActionProps) {
    const nextIconSrc = disabled
        ? "/icons/action/next-disabled.svg"
        : "/icons/action/next.svg";
    const visualIsActive = showActive && isActive;
    const pressedClass = showPressed
        ? visualIsActive || hoverAsActive
            ? variant === "destructive"
                ? "max-lg:active:bg-error-700 max-lg:active:text-action-text"
                : "max-lg:active:bg-blue-900 max-lg:active:text-action-text"
            : "max-lg:active:bg-action-hover"
        : undefined;
    const activeRouteClass = showActive
        ? variant === "destructive"
            ? cn(
                "aria-[current=page]:bg-error-700 aria-[current=page]:text-action-text aria-[current=page]:hover:bg-error-700 aria-[current=page]:hover:text-action-text",
                showPressed &&
                "max-lg:aria-[current=page]:active:bg-error-700 max-lg:aria-[current=page]:active:text-action-text",
            )
            : cn(
                "aria-[current=page]:bg-blue-900 aria-[current=page]:text-action-text aria-[current=page]:hover:bg-blue-900 aria-[current=page]:hover:text-action-text",
                showPressed &&
                "max-lg:aria-[current=page]:active:bg-blue-900 max-lg:aria-[current=page]:active:text-action-text",
            )
        : undefined;
    const hoverAsActiveClass = hoverAsActive
        ? variant === "destructive"
            ? "hover:bg-error-700 hover:text-action-text"
            : "hover:bg-blue-900 hover:text-action-text"
        : undefined;
    const hoverAsActiveTextClass = hoverAsActive
        ? cn(
            "group-hover/action:text-action-text",
            showPressed && "max-lg:group-active/action:text-action-text",
        )
        : undefined;

    return (
        <ButtonPrimitive
            data-slot="action"
            data-variant={variant}
            data-size={size}
            data-active={isActive ? "true" : "false"}
            disabled={disabled}
            className={cn(
                actionVariants({
                    variant,
                    size,
                    isActive: visualIsActive,
                    className,
                }),
                pressedClass,
                activeRouteClass,
                hoverAsActiveClass,
            )}
            {...props}
        >
            {/* Leading icon slot (icon phía trước, optional). */}
            {icon !== undefined && icon !== null ? (
                <span
                    className={cn(
                        "flex shrink-0 items-center justify-center",
                        size === "large" ? "size-6" : "size-5",
                        disabled
                            ? "text-action-disabled"
                            : variant === "destructive" && !visualIsActive
                                ? "text-action-destructive"
                                : "text-action-text",
                        hoverAsActiveTextClass,
                        "[&_svg]:size-full",
                    )}
                >
                    {icon}
                </span>
            ) : null}

            {/* Main text slot (vùng label và supporting text). */}
            <span
                className={cn(
                    "flex min-w-0 flex-1 flex-col justify-center",
                    variant === "destructive" && size === "small"
                        ? "gap-xs"
                        : "gap-sm",
                )}
            >
                {/* Label luôn có; nội dung label do nơi sử dụng truyền vào. */}
                <span
                    className={cn(
                        "block truncate font-body",
                        size === "large"
                            ? "text-label-large"
                            : "text-label-medium",
                        disabled
                            ? "text-action-disabled"
                            : variant === "destructive" && !visualIsActive
                                ? "text-action-destructive"
                                : "text-action-text",
                        hoverAsActiveTextClass,
                    )}
                >
                    {label}
                </span>

                {/* Supporting text là tùy chọn và không giữ khoảng trống khi không có. */}
                {supportingText !== undefined && supportingText !== null ? (
                    <span
                        className={cn(
                            "block truncate font-body",
                            size === "large"
                                ? "text-body-medium"
                                : "text-body-small",
                            disabled
                                ? "text-action-disabled"
                                : variant === "destructive" && !visualIsActive && size === "small"
                                    ? "text-action-destructive-supporting"
                                    : "text-action-supporting",
                            hoverAsActiveTextClass,
                        )}
                    >
                        {supportingText}
                    </span>
                ) : null}
            </span>

            {/* Trailing content slots (các vùng nội dung phụ phía sau). */}
            {dateTime !== undefined && dateTime !== null ? (
                <span
                    className={cn(
                        "shrink-0 font-body text-body-small",
                        disabled ? "text-action-disabled" : "text-action-supporting",
                        hoverAsActiveTextClass,
                    )}
                >
                    {dateTime}
                </span>
            ) : null}

            {badge !== undefined && badge !== null ? (
                <span className="shrink-0">{badge}</span>
            ) : null}

            {trailingGroup !== undefined && trailingGroup !== null ? (
                <span className="flex shrink-0 items-center">
                    {trailingGroup}
                </span>
            ) : null}

            {/* Trailing icon opt-in (chỉ hiển thị khi nơi dùng khai báo). */}
            {showTrailingIcon ? (
                <img
                    src={nextIconSrc}
                    alt=""
                    aria-hidden="true"
                    className="size-4 shrink-0"
                />
            ) : null}
        </ButtonPrimitive>
    );
}

export { Action };
