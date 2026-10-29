import { useState } from "react";

import { WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Stepper,
  type StepperConnectorState,
  type StepperOrientation,
  type StepperStep,
  type StepperStepState,
  type StepperStyle,
} from "@/components/ui/stepper";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const workflow = [
  { title: "Account", caption: "Required details" },
  { title: "Profile", caption: "Your information" },
  { title: "Review", caption: "Confirm details" },
] as const;

const orientationOptions = [
  { value: "Horizontal", label: "Horizontal" },
  { value: "Vertical", label: "Vertical" },
] as const satisfies ReadonlyArray<{
  value: StepperOrientation;
  label: string;
}>;

const styleOptions = [
  { value: "Text", label: "Numbers" },
  { value: "Icon", label: "Icons" },
] as const satisfies ReadonlyArray<{
  value: StepperStyle;
  label: string;
}>;

const stateLabels = {
  Default: "Not started",
  Focused: "Current step",
  Passed: "Complete",
  Error: "Needs attention",
} as const satisfies Record<StepperStepState, string>;

const styleLabels = {
  Text: "Numbers",
  Icon: "Icons",
} as const satisfies Record<StepperStyle, string>;

function getStepIcon(state: StepperStepState) {
  return state === "Default" || state === "Focused"
    ? <WarningCircle className="size-4" weight="duotone" />
    : undefined;
}

export default function AdminStepperComponentPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [orientation, setOrientation] = useState<StepperOrientation>("Horizontal");
  const [style, setStyle] = useState<StepperStyle>("Text");

  const liveSteps: StepperStep[] = workflow.map((step, index) => {
    const state: StepperStepState = index < currentStep
      ? "Passed"
      : index === currentStep
        ? "Focused"
        : "Default";
    const connectorState: StepperConnectorState = state === "Default"
      ? "Default"
      : "Active";

    return {
      title: step.title,
      caption: step.caption,
      state,
      connectorBefore: connectorState,
      connectorAfter: connectorState,
      stateLabel: stateLabels[state],
      icon: getStepIcon(state),
    };
  });

  const stateSamples: StepperStep[] = [
    {
      title: "Waiting",
      caption: "Not started",
      state: "Default",
      connectorBefore: "Default",
      connectorAfter: "Active",
      stateLabel: stateLabels.Default,
      icon: getStepIcon("Default"),
    },
    {
      title: "In progress",
      caption: "Current step",
      state: "Focused",
      connectorBefore: "Active",
      connectorAfter: "Active",
      stateLabel: stateLabels.Focused,
      icon: getStepIcon("Focused"),
    },
    {
      title: "Complete",
      caption: "Finished",
      state: "Passed",
      connectorBefore: "Active",
      connectorAfter: "Error",
      stateLabel: stateLabels.Passed,
    },
    {
      title: "Needs attention",
      caption: "Review the details",
      state: "Error",
      connectorBefore: "Error",
      connectorAfter: "Error",
      stateLabel: stateLabels.Error,
    },
  ];

  const sampleConfigurations: ReadonlyArray<{
    orientation: StepperOrientation;
    style: StepperStyle;
  }> = [
    { orientation: "Horizontal", style: "Text" },
    { orientation: "Horizontal", style: "Icon" },
    { orientation: "Vertical", style: "Text" },
    { orientation: "Vertical", style: "Icon" },
  ];

  return (
    <ComponentShowcaseLayout
      title="Stepper"
      description="A visual progress tracker. The parent page controls step state and decides when the flow moves."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Interactive, parent-controlled flow"
        criterion="Use Previous and Next to see the parent page update the step states."
      >
        <div className="space-y-5" data-testid="stepper-live-showcase">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-body-small font-medium text-foreground">
                Orientation
              </legend>
              <div className="flex flex-wrap gap-2">
                {orientationOptions.map((option) => (
                  <Button
                    key={option.value}
                    aria-pressed={orientation === option.value}
                    hierarchy={orientation === option.value ? "primary" : "secondary"}
                    onClick={() => setOrientation(option.value)}
                    size="small"
                    type="button"
                    variant="cta"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-body-small font-medium text-foreground">
                Marker style
              </legend>
              <div className="flex flex-wrap gap-2">
                {styleOptions.map((option) => (
                  <Button
                    key={option.value}
                    aria-pressed={style === option.value}
                    hierarchy={style === option.value ? "primary" : "secondary"}
                    onClick={() => setStyle(option.value)}
                    size="small"
                    type="button"
                    variant="cta"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </fieldset>
          </div>

          <div
            className="overflow-hidden rounded-lg bg-background px-4 py-6 sm:px-6"
            data-testid="stepper-live-preview"
          >
            <Stepper
              aria-label="Account setup progress"
              animated
              markerStyle={style}
              orientation={orientation}
              steps={liveSteps}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              aria-atomic="true"
              aria-live="polite"
              className="text-body-small text-foreground-muted"
            >
              {`Step ${currentStep + 1} of ${workflow.length}`}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={currentStep === 0}
                hierarchy="secondary"
                onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                size="small"
                type="button"
                variant="cta"
              >
                Previous
              </Button>
              <Button
                disabled={currentStep === workflow.length - 1}
                onClick={() => setCurrentStep((step) => Math.min(workflow.length - 1, step + 1))}
                size="small"
                type="button"
                variant="cta"
              >
                Next
              </Button>
            </div>
          </div>
          <p className="text-body-small text-foreground-muted">
            The page decides each step state and when to move; Stepper only displays the supplied state.
          </p>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Figma state and layout comparison"
        criterion="Compare all four states in both orientations and marker styles."
      >
        <div className="grid gap-4 xl:grid-cols-2" data-testid="stepper-state-showcase">
          {sampleConfigurations.map((configuration) => (
            <section
              key={`${configuration.orientation}-${configuration.style}`}
              className="min-w-0 space-y-3 rounded-lg border border-border-subtle p-4"
            >
              <h3 className="text-heading-small font-display">
                {`${styleLabels[configuration.style]} style · ${configuration.orientation.toLowerCase()}`}
              </h3>
              <div className="overflow-hidden rounded-lg bg-background px-4 py-5 sm:px-6">
                <Stepper
                  aria-label="Stepper state examples"
                  orientation={configuration.orientation}
                  steps={stateSamples}
                  markerStyle={configuration.style}
                />
              </div>
            </section>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Controlled usage example"
        criterion="The page derives each state from its own current-step value and passes the result into Stepper."
      >
        <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs leading-5 text-foreground">
        <code>{`const steps = data.map((step, index) => {
  const state = index < currentStep
    ? "Passed"
    : index === currentStep
      ? "Focused"
      : "Default";
  const connectorState = state === "Default" ? "Default" : "Active";

  return {
    ...step,
    state,
    connectorBefore: connectorState,
    connectorAfter: connectorState,
  };
});

<Stepper
  steps={steps}
  orientation="Horizontal"
  markerStyle="Text"
  animated
/>`}</code>
        </pre>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
