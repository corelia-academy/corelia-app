import type { ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const actionVariants = cva(
    // Shared layout scope (phạm vi layout dùng chung cho mọi Action).
    "group/action relative flex min-w-0 w-full items-center text-left select-none outline-none transition-[background-color,color,border-radius] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:select-none",
    {
        variants: {
            // Type scope (phạm vi loại hành động).
            variant: {
                // Normal action (hành động thông thường).
                default: "text-action-text",

                // Risky action (hành động nguy hiểm hoặc cần xác nhận).
                destructive: "text-action-destructive",
            },

            // Size scope (phạm vi kích thước). Default radius = 8px theo Figma.
            size: {
                // Large Action (Action lớn): padding theo Figma.
                large: "gap-lg rounded-md px-lg py-2md",

                // Small Action (Action nhỏ): padding theo Figma.
                small: "gap-lg rounded-md px-2md py-2md",
            },

            // Business active scope (phạm vi item đang được chọn).
            isActive: {
                true: "",
                false: "",
            },

            // Disabled scope (phạm vi trạng thái vô hiệu hóa).
            disabled: {
                true: "",
                false: "",
            },
        },
        compoundVariants: [
            // Chưa được chọn: hover (rê chuột) = action-hover.
            {
                isActive: false,
                disabled: false,
                class: "hover:bg-action-hover",
            },

            // isActive=true: giữ màu đang chọn khi hover (rê chuột).
            // Nhờ vậy state dùng chung của Action không đổi màu item active.
            {
                variant: "default",
                isActive: true,
                class: "bg-action-active text-action-active-foreground data-[active=true]:hover:bg-action-active data-[active=true]:hover:text-action-active-foreground",
            },
            {
                variant: "destructive",
                isActive: true,
                class: "bg-action-destructive-active text-action-destructive-active-foreground data-[active=true]:hover:bg-action-destructive-active data-[active=true]:hover:text-action-destructive-active-foreground",
            },
        ],
        defaultVariants: {
            variant: "default",
            size: "large",
            isActive: false,
            disabled: false,
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
        showIcon?: "left" | "right" | "both";
        isActive?: boolean;

        // Toggle active visual state (bật/tắt hiển thị trạng thái đang chọn).
        showActive?: boolean;

        // Optional visual override: use the active color while hovered
        // (tùy chọn hiển thị: dùng màu active khi rê chuột, không đổi business state).
        hoverAsActive?: boolean;

        // Toggle the transient pressed state (bật/tắt trạng thái đang nhấn).
        // Opt-in only: callers enable it explicitly when needed.
        showPressed?: boolean;

        // Let label and supporting text wrap instead of truncating to one line
        // (cho label và supporting text xuống dòng thay vì cắt một dòng; mặc định tắt).
        multiline?: boolean;
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
    showIcon,
    isActive = false,
    showActive = true,
    hoverAsActive = false,
    showPressed = false,
    multiline = false,
    disabled = false,
    ...props
}: ActionProps) {
    const visualIsActive = showActive && isActive;
    const activeForegroundClass = variant === "destructive"
        ? "text-action-destructive-active-foreground"
        : "text-action-active-foreground";
    const activeIconClass = variant === "destructive"
        ? "text-action-destructive-active-icon"
        : "text-action-active-icon";
    const activeSupportingClass = variant === "destructive"
        ? "text-action-destructive-active-supporting"
        : "text-action-active-supporting";
    const contentForegroundClass = visualIsActive
        ? activeForegroundClass
        : variant === "destructive"
            ? "text-action-destructive"
            : "text-action-text";
    const contentIconClass = visualIsActive
        ? activeIconClass
        : contentForegroundClass;
    const contentSupportingClass = visualIsActive
        ? activeSupportingClass
        : variant === "destructive"
            ? "text-action-destructive-supporting"
            : "text-action-supporting";
    const directionalIconClass = disabled
        ? "text-action-disabled-icon"
        : visualIsActive
            ? activeIconClass
            : "text-action-supporting";
    const pressedClass = showPressed && !disabled
        ? visualIsActive || hoverAsActive
            ? variant === "destructive"
                ? "max-lg:active:bg-action-destructive-active max-lg:active:text-action-destructive-active-foreground"
                : "max-lg:active:bg-action-active max-lg:active:text-action-active-foreground"
            : "max-lg:active:bg-action-hover"
        : undefined;
    const hoverAsActiveClass = hoverAsActive && !disabled
        ? variant === "destructive"
            ? "hover:bg-action-destructive-active hover:text-action-destructive-active-foreground"
            : "hover:bg-action-active hover:text-action-active-foreground"
        : undefined;
    const hoverAsActiveTextClass = hoverAsActive && !disabled
        ? variant === "destructive"
            ? cn(
                "group-hover/action:text-action-destructive-active-foreground",
                showPressed && "max-lg:group-active/action:text-action-destructive-active-foreground",
            )
            : cn(
                "group-hover/action:text-action-active-foreground",
                showPressed && "max-lg:group-active/action:text-action-active-foreground",
            )
        : undefined;
    const hoverAsActiveIconClass = hoverAsActive && !disabled
        ? variant === "destructive"
            ? cn(
                "group-hover/action:text-action-destructive-active-icon",
                showPressed && "max-lg:group-active/action:text-action-destructive-active-icon",
            )
            : cn(
                "group-hover/action:text-action-active-icon",
                showPressed && "max-lg:group-active/action:text-action-active-icon",
            )
        : undefined;
    const hoverAsActiveSupportingClass = hoverAsActive && !disabled
        ? variant === "destructive"
            ? hoverAsActiveTextClass
            : cn(
                "group-hover/action:text-action-supporting",
                showPressed && "max-lg:group-active/action:text-action-supporting",
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
                    disabled,
                    className,
                }),
                pressedClass,
                hoverAsActiveClass,
            )}
            {...props}
        >
            {/* Fixed directional icon at the leading edge (icon điều hướng cố định phía trước). */}
            {showIcon === "left" || showIcon === "both" ? (
                <CaretLeft
                    weight="duotone"
                    aria-hidden
                    data-slot="action-leading-icon"
                    className={cn(
                        "size-4 shrink-0",
                        directionalIconClass,
                        hoverAsActiveIconClass,
                    )}
                />
            ) : null}

            {/* Caller-provided leading icon slot (icon phía trước do nơi dùng truyền vào, optional). */}
            {icon !== undefined && icon !== null ? (
                <span
                    className={cn(
                        "flex shrink-0 items-center justify-center",
                        size === "large" ? "size-6" : "size-5",
                        disabled ? "text-action-disabled" : contentIconClass,
                        hoverAsActiveIconClass,
                        "[&_svg]:size-full",
                    )}
                >
                    {icon}
                </span>
            ) : null}

            {/* Main text slot (vùng label và supporting text). */}
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-xxs">
                {/* Label luôn có; nội dung label do nơi sử dụng truyền vào. */}
                <span
                    className={cn(
                        multiline ? "block break-words font-body" : "block truncate font-body",
                        size === "large"
                            ? "text-label-large leading-[22px] tracking-[0]"
                            : "text-label-medium leading-5 tracking-[-0.005em]",
                        disabled ? "text-action-disabled" : contentForegroundClass,
                        hoverAsActiveTextClass,
                    )}
                >
                    {label}
                </span>

                {/* Supporting text là tùy chọn và không giữ khoảng trống khi không có. */}
                {supportingText !== undefined && supportingText !== null ? (
                    <span
                        className={cn(
                            multiline ? "block break-words font-body" : "block truncate font-body",
                            size === "large"
                                ? "text-body-medium leading-[1.4]"
                                : "text-body-small leading-[1.25]",
                            disabled ? "text-action-disabled" : contentSupportingClass,
                            hoverAsActiveSupportingClass,
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
                        disabled ? "text-action-disabled" : contentSupportingClass,
                        hoverAsActiveSupportingClass,
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

            {/* Fixed directional icon at the trailing edge (icon điều hướng cố định phía sau). */}
            {showIcon === "right" || showIcon === "both" ? (
                <CaretRight
                    weight="duotone"
                    aria-hidden
                    data-slot="action-trailing-icon"
                    className={cn(
                        "size-4 shrink-0",
                        directionalIconClass,
                        hoverAsActiveIconClass,
                    )}
                />
            ) : null}
        </ButtonPrimitive>
    );
}

export { Action };
