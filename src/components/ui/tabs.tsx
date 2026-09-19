import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

type TabsLevel = 1 | "1" | "2a" | "2b" | "3a" | "3b"
type NormalizedTabsLevel = "1" | "2a" | "2b" | "3a" | "3b"
type TabsOrientation = "horizontal" | "vertical"

function normalizeTabsLevel(level: TabsLevel): NormalizedTabsLevel {
  return String(level) as NormalizedTabsLevel
}

type TabsStyleContextValue = {
  level: NormalizedTabsLevel
  orientation: TabsOrientation
}

const TabsRootContext = React.createContext<TabsOrientation>("horizontal")

const TabsStyleContext = React.createContext<TabsStyleContextValue>({
  level: "1",
  orientation: "horizontal",
})

const tabsListVariants = cva(
  "flex min-w-0 data-[orientation=vertical]:w-full",
  {
    variants: {
      level: {
        "1": "gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-2",
        "2a": "gap-4 data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-2",
        "2b": "gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-2",
        "3a": "gap-3 data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-2",
        "3b": "gap-2 data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-2",
      },
    },
    defaultVariants: {
      level: "1",
    },
  },
)

const tabsTabVariants = cva(
  "group/tabs inline-flex w-auto shrink-0 items-center justify-center gap-2 border-0 font-body text-title-medium font-medium leading-5 tracking-[-0.14px] whitespace-nowrap outline-none transition-colors duration-150 ease-out select-none focus-visible:ring-2 focus-visible:ring-tabs-border-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed data-[disabled]:cursor-not-allowed data-[disabled]:focus-visible:ring-0 data-[orientation=vertical]:w-full [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      level: {
        "1":
          "rounded-md px-4 py-2.5 text-tabs-text-primary hover:bg-tabs-surface-hover data-[disabled]:hover:bg-transparent data-[active]:ring-1 data-[active]:ring-inset data-[active]:ring-tabs-border-secondary data-[active]:bg-tabs-surface-hover data-[active]:text-tabs-active-text-level1 data-[disabled]:text-tabs-text-disabled",
        "2a":
          "relative rounded-none pt-2 pb-3 text-tabs-text-primary after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:content-[''] hover:text-tabs-active-text-level2a hover:after:bg-tabs-border-divider data-[disabled]:hover:text-tabs-text-disabled data-[disabled]:hover:after:bg-transparent data-[active]:text-tabs-active-text-level2a data-[active]:after:bg-tabs-active-accent data-[disabled]:text-tabs-text-disabled data-[disabled]:after:bg-transparent data-[orientation=vertical]:after:hidden",
        "2b":
          "rounded-md px-2.5 py-2 text-tabs-text-primary hover:bg-tabs-surface-hover data-[disabled]:hover:bg-transparent data-[active]:ring-1 data-[active]:ring-inset data-[active]:ring-tabs-border-active data-[active]:bg-tabs-surface-hover data-[disabled]:text-tabs-text-disabled",
        "3a":
          "rounded-full px-4 py-2 text-tabs-text-gray ring-1 ring-inset ring-tabs-border-divider hover:text-tabs-text-primary data-[disabled]:hover:text-tabs-text-disabled data-[active]:ring-tabs-border-active data-[active]:text-tabs-text-primary data-[disabled]:ring-0 data-[disabled]:text-tabs-text-disabled",
        "3b":
          "rounded-full px-4 py-2 text-tabs-text-gray ring-1 ring-inset ring-tabs-border-divider hover:text-tabs-active-text-level2a data-[disabled]:hover:text-tabs-text-disabled data-[active]:ring-tabs-border-secondary data-[active]:text-tabs-active-text-level1 data-[disabled]:ring-0 data-[disabled]:text-tabs-text-disabled",
      },
    },
    defaultVariants: {
      level: "1",
    },
  },
)

const tabsBadgeVariants = cva(
  "-ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-1 font-body text-title-xsmall font-medium leading-[1.2] whitespace-nowrap group-data-[disabled]/tabs:bg-tabs-badge-disabled group-data-[disabled]/tabs:text-tabs-text-disabled",
  {
    variants: {
      level: {
        "1":
          "bg-tabs-badge-background text-tabs-badge-text group-data-[active]/tabs:bg-tabs-badge-active group-data-[active]/tabs:text-tabs-text-invert",
        "2a":
          "bg-tabs-badge-background text-tabs-badge-text group-data-[active]/tabs:bg-tabs-badge-active group-data-[active]/tabs:text-tabs-text-invert",
        "2b": "bg-tabs-badge-background text-tabs-badge-text",
        "3a": "bg-tabs-badge-background text-tabs-badge-text",
        "3b":
          "bg-tabs-badge-background text-tabs-badge-text group-data-[active]/tabs:bg-tabs-badge-active group-data-[active]/tabs:text-tabs-text-invert",
      },
    },
    defaultVariants: {
      level: "1",
    },
  },
)

const tabsGroupVariants = cva(
  "flex w-fit min-w-0 data-[orientation=vertical]:flex-col",
  {
    variants: {
      level: {
        "1":
          "items-center rounded-md border border-tabs-border-input bg-tabs-background shadow-tabs data-[orientation=vertical]:w-[200px] data-[orientation=vertical]:rounded-xl data-[orientation=vertical]:p-2",
        "2a": "items-center border-b border-tabs-border-input",
        "2b":
          "items-center rounded-md border border-tabs-border-input bg-tabs-background data-[orientation=vertical]:w-[192px] data-[orientation=vertical]:rounded-xl data-[orientation=vertical]:p-2",
        "3a": "items-center data-[orientation=vertical]:w-[196px]",
        "3b": "items-center data-[orientation=vertical]:w-[192px]",
      },
    },
    defaultVariants: {
      level: "1",
    },
  },
)

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  level?: TabsLevel
}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, level: requestedLevel, ...props }, ref) => {
    const orientation = React.useContext(TabsRootContext)
    const styleContext = React.useContext(TabsStyleContext)
    const level =
      requestedLevel === undefined
        ? styleContext.level
        : normalizeTabsLevel(requestedLevel)
    const baseClassName = tabsListVariants({ level })
    const mergedClassName =
      typeof className === "function"
        ? (state: Parameters<typeof className>[0]) =>
            cn(baseClassName, className(state))
        : cn(baseClassName, className)

    return (
      <TabsStyleContext.Provider value={{ level, orientation }}>
        <TabsPrimitive.List
          ref={ref}
          data-slot="tabs-list"
          data-level={level}
          data-orientation={orientation}
          className={mergedClassName}
          {...props}
        />
      </TabsStyleContext.Provider>
    )
  },
)
TabsList.displayName = "TabsList"

type TabsTabProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Tab>

const TabsTab = React.forwardRef<HTMLElement, TabsTabProps>(
  ({ className, ...props }, ref) => {
    const { level } = React.useContext(TabsStyleContext)
    const baseClassName = tabsTabVariants({ level })
    const mergedClassName =
      typeof className === "function"
        ? (state: Parameters<typeof className>[0]) =>
            cn(baseClassName, className(state))
        : cn(baseClassName, className)

    return (
      <TabsPrimitive.Tab
        ref={ref}
        data-slot="tabs-tab"
        data-level={level}
        className={mergedClassName}
        {...props}
      />
    )
  },
)
TabsTab.displayName = "TabsTab"

type TabsPanelProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Panel>

const TabsPanel = React.forwardRef<HTMLDivElement, TabsPanelProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Panel
      ref={ref}
      data-slot="tabs-panel"
      className={className}
      {...props}
    />
  ),
)
TabsPanel.displayName = "TabsPanel"

type TabsBadgeProps = React.HTMLAttributes<HTMLSpanElement>

const TabsBadge = React.forwardRef<HTMLSpanElement, TabsBadgeProps>(
  ({ className, ...props }, ref) => {
    const { level } = React.useContext(TabsStyleContext)

    return (
      <span
        ref={ref}
        data-slot="tabs-badge"
        className={cn(tabsBadgeVariants({ level, className }))}
        {...props}
      />
    )
  },
)
TabsBadge.displayName = "TabsBadge"

type TabsGroupProps = React.HTMLAttributes<HTMLDivElement> &
  Omit<VariantProps<typeof tabsGroupVariants>, "level"> & {
    level?: TabsLevel
  }

const TabsGroup = React.forwardRef<HTMLDivElement, TabsGroupProps>(
  ({ className, level = 1, children, ...props }, ref) => {
    const normalizedLevel = normalizeTabsLevel(level)
    const orientation = React.useContext(TabsRootContext)

    return (
      <TabsStyleContext.Provider value={{ level: normalizedLevel, orientation }}>
        <div
          ref={ref}
          data-slot="tabs-group"
          data-level={normalizedLevel}
          data-orientation={orientation}
          className={cn(tabsGroupVariants({ level: normalizedLevel, className }))}
          {...props}
        >
          {children}
        </div>
      </TabsStyleContext.Provider>
    )
  },
)
TabsGroup.displayName = "TabsGroup"

type TabsRootProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>

const TabsRoot = React.forwardRef<HTMLDivElement, TabsRootProps>(
  ({ children, orientation = "horizontal", ...props }, ref) => (
    <TabsRootContext.Provider value={orientation}>
      <TabsPrimitive.Root ref={ref} orientation={orientation} {...props}>
        {children}
      </TabsPrimitive.Root>
    </TabsRootContext.Provider>
  ),
)
TabsRoot.displayName = "TabsRoot"

const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
  Indicator: TabsPrimitive.Indicator,
  Badge: TabsBadge,
}

export {
  Tabs,
  TabsGroup,
  TabsBadge,
  TabsList,
  TabsPanel,
  TabsTab,
}
export type { TabsGroupProps, TabsLevel, TabsOrientation, TabsRootProps }
