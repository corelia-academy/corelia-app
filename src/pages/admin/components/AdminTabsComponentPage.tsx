import { useState } from "react";

import {
  Tabs,
  TabsGroup,
  type TabsLevel,
  type TabsOrientation,
} from "@/components/ui/tabs";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const levels = [1, "2a", "2b", "3a", "3b"] as const satisfies readonly TabsLevel[];
const orientations = ["horizontal", "vertical"] as const satisfies readonly TabsOrientation[];

const tabItems = [
  {
    value: "overview",
    label: "Overview",
    badge: "3",
    description: "Primary content for the selected tab group.",
    disabled: false,
  },
  {
    value: "activity",
    label: "Activity",
    badge: "12",
    description: "Recent activity is shown when this tab is selected.",
    disabled: false,
  },
  {
    value: "settings",
    label: "Settings",
    badge: "0",
    description: "This example keeps Settings disabled for state inspection.",
    disabled: true,
  },
] as const;

type ShowcaseTabValue = (typeof tabItems)[number]["value"];
type TabsPresentation = "standalone" | "grouped";

type AdminTabsComponentPageProps = {
  embedded?: boolean;
};

type TabsExampleProps = {
  presentation: TabsPresentation;
  level: TabsLevel;
  orientation: TabsOrientation;
  activateOnFocus?: boolean;
  idSuffix?: string;
};

function isShowcaseTabValue(value: unknown): value is ShowcaseTabValue {
  return tabItems.some((tab) => tab.value === value);
}

function TabsExample({
  presentation,
  level,
  orientation,
  activateOnFocus = false,
  idSuffix,
}: TabsExampleProps) {
  const [value, setValue] = useState<ShowcaseTabValue>("overview");
  const normalizedLevel = String(level);
  const exampleId = [
    `tabs-${presentation}-${normalizedLevel}-${orientation}`,
    idSuffix,
  ]
    .filter(Boolean)
    .join("-");
  const presentationLabel = presentation === "standalone" ? "Standalone" : "Group";
  const orientationLabel = presentation === "grouped" ? ` ${orientation}` : "";

  const tabsList = (
    <Tabs.List
      level={presentation === "standalone" ? level : undefined}
      aria-label={`${presentationLabel} Level ${normalizedLevel}${orientationLabel} tabs`}
      activateOnFocus={activateOnFocus}
    >
      {tabItems.map((tab) => (
        <Tabs.Tab
          key={tab.value}
          value={tab.value}
          disabled={tab.disabled}
          data-testid={`${exampleId}-tab-${tab.value}`}
        >
          {tab.label}
          <Tabs.Badge>{tab.badge}</Tabs.Badge>
        </Tabs.Tab>
      ))}
    </Tabs.List>
  );

  return (
    <div data-testid={exampleId} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-title-medium font-display">
          Level {normalizedLevel}
          {presentation === "grouped" ? ` · ${orientation}` : ""}
        </h4>
        <span className="text-label-small text-foreground-muted">
          {presentationLabel} controlled example
        </span>
      </div>

      <Tabs.Root
        value={value}
        onValueChange={(nextValue) => {
          if (isShowcaseTabValue(nextValue)) {
            setValue(nextValue);
          }
        }}
        orientation={orientation}
        data-testid={`${exampleId}-root`}
        className={
          orientation === "vertical"
            ? "grid items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)]"
            : "space-y-4"
        }
      >
        {presentation === "grouped" ? (
          <TabsGroup level={level}>{tabsList}</TabsGroup>
        ) : (
          tabsList
        )}

        <div className="min-w-0 space-y-3">
          {tabItems.map((tab) => (
            <Tabs.Panel
              key={tab.value}
              value={tab.value}
              keepMounted
              data-testid={`${exampleId}-panel-${tab.value}`}
              className="min-w-0 rounded-md border border-border-subtle bg-surface-raised p-4"
            >
              <p className="text-title-small font-display">{tab.label} panel</p>
              <p className="mt-1 text-body-small text-foreground-muted">
                {tab.description}
              </p>
            </Tabs.Panel>
          ))}
        </div>
      </Tabs.Root>
    </div>
  );
}

function getExampleOrientations(
  presentation: TabsPresentation,
  level: TabsLevel,
): readonly TabsOrientation[] {
  if (presentation === "standalone" || String(level) === "2a") {
    return ["horizontal"];
  }

  return orientations;
}

const standaloneLevelRows = [
  [1],
  ["2a", "2b"],
  ["3a", "3b"],
] as const satisfies readonly (readonly TabsLevel[])[];

function StandaloneTabsLevelMatrix() {
  return (
    <div className="space-y-8">
      {standaloneLevelRows.map((row) => (
        <div
          key={row.join("-")}
          className="grid min-w-0 gap-6 xl:grid-cols-2"
        >
          {row.map((level) => (
            <section
              key={String(level)}
              data-testid={`tabs-standalone-level-${String(level)}`}
              className={row.length === 1 ? "min-w-0 xl:col-span-2" : "min-w-0"}
            >
              <TabsExample
                presentation="standalone"
                level={level}
                orientation="horizontal"
              />
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}

function GroupedTabsLevelMatrix() {
  return (
    <div className="space-y-8">
      {levels.map((level) => (
        <section
          key={String(level)}
          data-testid={`tabs-grouped-level-${String(level)}`}
          className="space-y-4"
        >
          <h3 className="text-title-medium font-display">
            Level {String(level)}
          </h3>
          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            {getExampleOrientations("grouped", level).map((orientation) => (
              <TabsExample
                key={`grouped-${String(level)}-${orientation}`}
                presentation="grouped"
                level={level}
                orientation={orientation}
                activateOnFocus={level === "2b" && orientation === "vertical"}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TabsLevelMatrix({ presentation }: { presentation: TabsPresentation }) {
  return presentation === "standalone" ? (
    <StandaloneTabsLevelMatrix />
  ) : (
    <GroupedTabsLevelMatrix />
  );
}

export default function AdminTabsComponentPage({
  embedded = false,
}: AdminTabsComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Tabs"
      description="Inspect standalone Tabs and Tabs Group separately across all five Figma levels, both orientations, interactive states, controlled panels, and keyboard behavior."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Standalone Tabs"
        criterion="Tabs owns selection, panels, accessibility, and keyboard behavior; Tabs.List receives the optional visual level without a group wrapper."
      >
        <TabsLevelMatrix presentation="standalone" />
      </ShowcaseSection>

      <ShowcaseSection
        title="Tabs Group"
        criterion="TabsGroup owns the Figma visual container while Tabs continues to own real selection, panels, accessibility, and keyboard behavior."
      >
        <TabsLevelMatrix presentation="grouped" />
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
