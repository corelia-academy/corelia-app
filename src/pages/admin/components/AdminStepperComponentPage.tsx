import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Stepper,
  type StepperOrientation,
  type StepperStep,
  type StepperStepState,
  type StepperStyle,
} from "@/components/ui/stepper";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const workflow = [
  { title: "account", caption: "accountCaption" },
  { title: "profile", caption: "profileCaption" },
  { title: "review", caption: "reviewCaption" },
] as const;

const orientationOptions = [
  { value: "Horizontal", translationKey: "componentShowcase.stepper.orientation.horizontal" },
  { value: "Vertical", translationKey: "componentShowcase.stepper.orientation.vertical" },
] as const satisfies ReadonlyArray<{
  value: StepperOrientation;
  translationKey: string;
}>;

const styleOptions = [
  { value: "Text", translationKey: "componentShowcase.stepper.style.text" },
  { value: "Icon", translationKey: "componentShowcase.stepper.style.icon" },
] as const satisfies ReadonlyArray<{
  value: StepperStyle;
  translationKey: string;
}>;

const stateTranslationKeys = {
  Default: "componentShowcase.stepper.state.default",
  Focused: "componentShowcase.stepper.state.focused",
  Passed: "componentShowcase.stepper.state.passed",
  Error: "componentShowcase.stepper.state.error",
} as const satisfies Record<StepperStepState, string>;

const styleTranslationKeys = {
  Text: "componentShowcase.stepper.style.text",
  Icon: "componentShowcase.stepper.style.icon",
} as const satisfies Record<StepperStyle, string>;

const configurationTranslationKeys = {
  Horizontal: "componentShowcase.stepper.configuration.horizontal",
  Vertical: "componentShowcase.stepper.configuration.vertical",
} as const satisfies Record<StepperOrientation, string>;

export default function AdminStepperComponentPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { t } = useTranslation("common");
  const [currentStep, setCurrentStep] = useState(1);
  const [orientation, setOrientation] = useState<StepperOrientation>("Horizontal");
  const [style, setStyle] = useState<StepperStyle>("Text");

  const liveSteps: StepperStep[] = workflow.map((step, index) => {
    const state: StepperStepState = index < currentStep
      ? "Passed"
      : index === currentStep
        ? "Focused"
        : "Default";

    return {
      title: t(`componentShowcase.stepper.steps.${step.title}`),
      caption: t(`componentShowcase.stepper.steps.${step.caption}`),
      state,
      stateLabel: t(stateTranslationKeys[state]),
    };
  });

  const stateSamples: StepperStep[] = [
    {
      title: t("componentShowcase.stepper.samples.waiting"),
      caption: t("componentShowcase.stepper.samples.optional"),
      state: "Default",
      stateLabel: t("componentShowcase.stepper.state.default"),
    },
    {
      title: t("componentShowcase.stepper.samples.current"),
      caption: t("componentShowcase.stepper.samples.inProgress"),
      state: "Focused",
      stateLabel: t("componentShowcase.stepper.state.focused"),
    },
    {
      title: t("componentShowcase.stepper.samples.complete"),
      caption: t("componentShowcase.stepper.samples.done"),
      state: "Passed",
      stateLabel: t("componentShowcase.stepper.state.passed"),
    },
    {
      title: t("componentShowcase.stepper.samples.problem"),
      caption: t("componentShowcase.stepper.samples.checkDetails"),
      state: "Error",
      stateLabel: t("componentShowcase.stepper.state.error"),
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
      title={t("componentShowcase.stepper.title")}
      description={t("componentShowcase.stepper.description")}
      embedded={embedded}
    >
      <ShowcaseSection
        title={t("componentShowcase.stepper.liveTitle")}
        criterion={t("componentShowcase.stepper.liveCriterion")}
      >
        <div className="space-y-5" data-testid="stepper-live-showcase">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-body-small font-medium text-foreground">
                {t("componentShowcase.stepper.orientationLabel")}
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
                    {t(option.translationKey)}
                  </Button>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-body-small font-medium text-foreground">
                {t("componentShowcase.stepper.styleLabel")}
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
                    {t(option.translationKey)}
                  </Button>
                ))}
              </div>
            </fieldset>
          </div>

          <div
            className="overflow-hidden rounded-lg bg-[var(--neutral-900)] px-4 py-6 sm:px-6"
            data-testid="stepper-live-preview"
          >
            <Stepper
              aria-label={t("componentShowcase.stepper.liveAccessibleLabel")}
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
              {t("componentShowcase.stepper.currentStep", {
                current: currentStep + 1,
                total: workflow.length,
              })}
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
                {t("componentShowcase.stepper.previous")}
              </Button>
              <Button
                disabled={currentStep === workflow.length - 1}
                onClick={() => setCurrentStep((step) => Math.min(workflow.length - 1, step + 1))}
                size="small"
                type="button"
                variant="cta"
              >
                {t("componentShowcase.stepper.next")}
              </Button>
            </div>
          </div>
          <p className="text-body-small text-foreground-muted">
            {t("componentShowcase.stepper.parentOwnsState")}
          </p>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title={t("componentShowcase.stepper.statesTitle")}
        criterion={t("componentShowcase.stepper.statesCriterion")}
      >
        <div className="grid gap-4 xl:grid-cols-2" data-testid="stepper-state-showcase">
          {sampleConfigurations.map((configuration) => (
            <section
              key={`${configuration.orientation}-${configuration.style}`}
              className="min-w-0 space-y-3 rounded-lg border border-border-subtle p-4"
            >
              <h3 className="text-heading-small font-display">
                {t(configurationTranslationKeys[configuration.orientation], {
                  style: t(styleTranslationKeys[configuration.style]),
                })}
              </h3>
              <div className="overflow-hidden rounded-lg bg-[var(--neutral-900)] px-4 py-5 sm:px-6">
                <Stepper
                  aria-label={t("componentShowcase.stepper.statesAccessibleLabel")}
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
        title={t("componentShowcase.stepper.usageTitle")}
        criterion={t("componentShowcase.stepper.usageCriterion")}
      >
        <pre className="overflow-x-auto rounded-lg bg-[var(--neutral-900)] p-4 text-xs leading-5 text-[var(--neutral-200)]">
          <code>{`const steps = data.map((step, index) => ({
  ...step,
  state: index < currentStep
    ? "Passed"
    : index === currentStep
      ? "Focused"
      : "Default",
}));

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
