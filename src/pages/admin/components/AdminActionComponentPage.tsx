import { useState } from "react";
import { Settings } from "lucide-react";

import { Action } from "@/components/ui/action";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const variants = ["default", "destructive"] as const;
const sizes = ["large", "small"] as const;
const states = ["default", "pressed", "hoverAsActive", "disabled"] as const;
const stateLabels: Record<(typeof states)[number], string> = {
  default: "Default",
  pressed: "Pressed",
  hoverAsActive: "Hover as active",
  disabled: "Disabled",
};

type AdminActionComponentPageProps = {
  embedded?: boolean;
};

export default function AdminActionComponentPage({
  embedded = false,
}: AdminActionComponentPageProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  return (
    <ComponentShowcaseLayout
      title="Action"
      description="Inspect Action variants, content combinations, and interaction states in the admin component lab."
      embedded={embedded}
    >
      <ShowcaseSection
        title="State reference"
        criterion="Click an enabled Action to make it active while inspecting hoverAsActive, pressed and disabled for every variant and size."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {variants.flatMap((variant) => sizes.map((size) => (
            <div
              key={`${variant}-${size}`}
              className="space-y-3 rounded-lg border border-border-subtle bg-surface-base p-4"
            >
              <p className="text-body-small text-foreground-muted">{variant} / {size}</p>
              <div className="space-y-3">
                {states.map((state) => {
                  const actionId = `${variant}-${size}-${state}`;

                  return (
                    <Action
                      key={state}
                      data-testid={`action-state-${actionId}`}
                      variant={variant}
                      size={size}
                      label={stateLabels[state]}
                      icon={<Settings />}
                      supportingText="Supporting information for this action"
                      showTrailingIcon
                      hoverAsActive={state === "hoverAsActive"}
                      showPressed={state === "pressed"}
                      showActive
                      isActive={activeAction === actionId}
                      disabled={state === "disabled"}
                      onClick={() => setActiveAction(actionId)}
                    />
                  );
                })}
              </div>
            </div>
          )))}
        </div>

        <p role="status" aria-live="polite" className="text-body-small text-foreground-muted">
          Active state: {activeAction ?? "—"}
        </p>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
