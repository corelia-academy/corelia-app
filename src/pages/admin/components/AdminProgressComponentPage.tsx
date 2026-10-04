import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import {
  LessonProgressBar,
  ProgressBar,
  ProgressCircle,
  type ProgressCircleColorVariant,
  type ProgressLevel,
  type ProgressTheme,
} from "@/components/ui/progress";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const progressThemes = [
  { value: "Neutral", key: "neutral" },
  { value: "Accent", key: "accent" },
  { value: "Status", key: "status" },
] as const satisfies ReadonlyArray<{ value: ProgressTheme; key: string }>;

const progressLevels = [
  { value: "None", key: "none", percentage: 0 },
  { value: "Low", key: "low", percentage: 20 },
  { value: "Medium", key: "medium", percentage: 40 },
  { value: "Good", key: "good", percentage: 80 },
  { value: "Done", key: "done", percentage: 100 },
] as const satisfies ReadonlyArray<{ value: ProgressLevel; key: string; percentage: number }>;

const progressThemeTranslationKeys = {
  neutral: "componentShowcase.progress.theme.neutral",
  accent: "componentShowcase.progress.theme.accent",
  status: "componentShowcase.progress.theme.status",
} as const;

const progressLevelTranslationKeys = {
  none: "componentShowcase.progress.level.none",
  low: "componentShowcase.progress.level.low",
  medium: "componentShowcase.progress.level.medium",
  good: "componentShowcase.progress.level.good",
  done: "componentShowcase.progress.level.done",
} as const;

const circleStateTranslationKeys = {
  notStarted: "componentShowcase.progress.circleState.notStarted",
  neutralProgress: "componentShowcase.progress.circleState.neutralProgress",
  coloredProgress: "componentShowcase.progress.circleState.coloredProgress",
  done: "componentShowcase.progress.circleState.done",
  failed: "componentShowcase.progress.circleState.failed",
} as const;

type CircleStateKey = keyof typeof circleStateTranslationKeys;

const statusColorTokens: Record<Exclude<ProgressLevel, "None">, string> = {
  Low: "progress-status-low",
  Medium: "progress-status-medium",
  Good: "progress-status-good",
  Done: "progress-status-done",
};

const circlePercentages = [
  { value: 90, colorVariant: "90", colorToken: "progress-circle-success" },
  { value: 70, colorVariant: "70", colorToken: "progress-circle-blue" },
  { value: 50, colorVariant: "50", colorToken: "progress-circle-purple" },
  { value: 40, colorVariant: "40", colorToken: "progress-circle-sky" },
  { value: 30, colorVariant: "30", colorToken: "progress-circle-yellow" },
  { value: 10, colorVariant: "10", colorToken: "progress-circle-neutral" },
] as const satisfies ReadonlyArray<{
  value: number;
  colorVariant: Exclude<ProgressCircleColorVariant, "Default">;
  colorToken: string;
}>;

type CircleSample = {
  id: string;
  stateKey: CircleStateKey;
  percentage: number;
  colorVariant: ProgressCircleColorVariant;
  process: boolean;
  colored: boolean;
  done: boolean;
  failed: boolean;
  colorToken: string | null;
};

const circleGroups: ReadonlyArray<{ id: string; titleKey: CircleStateKey; samples: CircleSample[] }> = [
  {
    id: "not-started",
    titleKey: "notStarted",
    samples: [{
      id: "default",
      stateKey: "notStarted",
      percentage: 0,
      colorVariant: "Default",
      process: false,
      colored: false,
      done: false,
      failed: false,
      colorToken: null,
    }],
  },
  {
    id: "neutral-progress",
    titleKey: "neutralProgress",
    samples: circlePercentages.map(({ value }) => ({
      id: "neutral-" + value,
      stateKey: "neutralProgress",
      percentage: value,
      colorVariant: "Default",
      process: true,
      colored: false,
      done: false,
      failed: false,
      colorToken: "progress-neutral",
    })),
  },
  {
    id: "colored-progress",
    titleKey: "coloredProgress",
    samples: circlePercentages.map(({ value, colorVariant, colorToken }) => ({
      id: "colored-" + value,
      stateKey: "coloredProgress",
      percentage: value,
      colorVariant,
      process: true,
      colored: true,
      done: false,
      failed: false,
      colorToken,
    })),
  },
  {
    id: "done",
    titleKey: "done",
    samples: circlePercentages.map(({ colorVariant, colorToken }) => ({
      id: "done-" + colorVariant,
      stateKey: "done",
      percentage: 100,
      colorVariant,
      process: true,
      colored: true,
      done: true,
      failed: false,
      colorToken,
    })),
  },
  {
    id: "failed",
    titleKey: "failed",
    samples: [{
      id: "failed-default",
      stateKey: "failed",
      percentage: 0,
      colorVariant: "Default",
      process: false,
      colored: false,
      done: false,
      failed: true,
      colorToken: "progress-status-low",
    }],
  },
];
function getLiveCircleStateKey(percentage: number, colored: boolean): CircleStateKey {
  if (percentage === 0) return "notStarted";
  if (percentage > 100) return "failed";
  if (percentage === 100) return "done";
  return colored ? "coloredProgress" : "neutralProgress";
}

function getLiveStatusLevel(percentage: number): Exclude<ProgressLevel, "None"> {
  if (percentage > 100) return "Low";
  if (percentage === 100) return "Done";
  if (percentage > 40) return "Good";
  if (percentage > 20) return "Medium";
  return "Low";
}

function getProgressColorToken(theme: ProgressTheme, level: Exclude<ProgressLevel, "None">) {
  if (theme === "Neutral") return "progress-neutral-fill";
  if (theme === "Accent") return "progress-accent-fill";
  return statusColorTokens[level];
}

export default function AdminProgressComponentPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { t } = useTranslation("common");
  const [livePercentage, setLivePercentage] = useState(65);
  const [livePercentageInput, setLivePercentageInput] = useState("65");
  const isLiveDone = livePercentage === 100;
  const isLiveFailed = livePercentage > 100;
  const isLiveProcessing = livePercentage > 0 && livePercentage < 100;
  const updateLivePercentage = (percentage: number) => {
    const nextPercentage = Math.max(0, Math.trunc(percentage));
    setLivePercentage(nextPercentage);
    setLivePercentageInput(String(nextPercentage));
  };
  const liveProgressValue = t("componentShowcase.progress.liveValue", {
    percentage: livePercentage,
  });
  const liveNeutralCircleLabel = t("componentShowcase.progress.circleSample", {
    state: t(circleStateTranslationKeys[getLiveCircleStateKey(livePercentage, false)]),
    percentage: livePercentage,
    colorText: "",
  });
  const liveColoredCircleLabel = t("componentShowcase.progress.circleSample", {
    state: t(circleStateTranslationKeys[getLiveCircleStateKey(livePercentage, true)]),
    percentage: livePercentage,
    colorText: livePercentage > 0 && !isLiveFailed ? " · progress-circle-purple" : "",
  });

  return (
    <ComponentShowcaseLayout
      title={t("componentShowcase.progress.title")}
      description={t("componentShowcase.progress.description")}
      embedded={embedded}
    >
      <ShowcaseSection
        title={t("componentShowcase.progress.liveTitle")}
        criterion={t("componentShowcase.progress.liveCriterion")}
      >
        <div
          className="space-y-4 rounded-lg border border-border-subtle bg-surface-base p-4"
          data-testid="progress-live-showcase"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label
              className="text-body-small text-foreground"
              htmlFor="progress-live-percentage"
            >
              {liveProgressValue}
            </label>
            <span className="text-body-small text-foreground-muted">
              {t("componentShowcase.progress.liveRangeLabel")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label={t("componentShowcase.progress.liveDecrease")}
              disabled={livePercentage === 0}
              hierarchy="secondary"
              onClick={() => updateLivePercentage(livePercentage - 1)}
              type="button"
            >
              −
            </Button>
            <label
              className="text-body-small text-foreground"
              htmlFor="progress-live-number"
            >
              {t("componentShowcase.progress.liveInputLabel")}
            </label>
            <input
              className="h-10 w-24 rounded-md border border-border-subtle bg-surface-base px-3 text-center text-body-small text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              data-testid="progress-live-number"
              id="progress-live-number"
              inputMode="numeric"
              min={0}
              onBlur={() => setLivePercentageInput(String(livePercentage))}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                const nextPercentage = event.currentTarget.valueAsNumber;
                setLivePercentageInput(nextValue);
                if (nextValue !== "" && Number.isInteger(nextPercentage) && nextPercentage >= 0) {
                  setLivePercentage(nextPercentage);
                }
              }}
              step={1}
              type="number"
              value={livePercentageInput}
            />
            <Button
              aria-label={t("componentShowcase.progress.liveIncrease")}
              onClick={() => updateLivePercentage(livePercentage + 1)}
              type="button"
            >
              +
            </Button>
          </div>
          <input
            aria-label={t("componentShowcase.progress.liveRangeLabel")}
            aria-valuetext={liveProgressValue}
            className="w-full accent-[var(--progress-accent-fill)]"
            data-testid="progress-live-range"
            id="progress-live-percentage"
            max={100}
            min={0}
            onChange={(event) => updateLivePercentage(event.currentTarget.valueAsNumber)}
            step={1}
            type="range"
            value={Math.min(livePercentage, 100)}
          />
          <p className="text-body-small text-foreground-muted">
            {t("componentShowcase.progress.liveOverrunHint")}
          </p>
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {progressThemes.map((theme) => {
              const themeLabel = t(progressThemeTranslationKeys[theme.key]);

              return (
                <div
                  key={theme.value}
                  className="min-w-0 rounded-lg border border-border-subtle bg-surface-base p-3"
                >
                  <p className="mb-2 text-body-small text-foreground-muted">
                    {themeLabel} · {livePercentage}%
                  </p>
                  <ProgressBar
                    animated
                    aria-label={t("componentShowcase.progress.liveBarSample", {
                      theme: themeLabel,
                      percentage: livePercentage,
                    })}
                    progress={livePercentage}
                    statusLevel={theme.value === "Status" ? getLiveStatusLevel(livePercentage) : undefined}
                    text={t("componentShowcase.progress.label")}
                    theme={theme.value}
                  />
                </div>
              );
            })}
            <div className="min-w-0 rounded-lg border border-border-subtle bg-surface-base p-3">
              <p className="mb-2 text-body-small text-foreground-muted">
                {t("componentShowcase.progress.compactTitle")} · {livePercentage}%
              </p>
              <LessonProgressBar
                aria-label={t("componentShowcase.progress.liveBarSample", {
                  theme: t("componentShowcase.progress.theme.accent"),
                  percentage: livePercentage,
                })}
                progress={livePercentage}
                text={t("componentShowcase.progress.label")}
              />
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border-subtle bg-surface-base p-3">
              <ProgressCircle
                aria-label={liveNeutralCircleLabel}
                done={isLiveDone}
                failed={isLiveFailed}
                percentage={livePercentage}
                process={isLiveProcessing}
              />
              <span className="text-body-small text-foreground-muted">
                {liveNeutralCircleLabel}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border-subtle bg-surface-base p-3">
              <ProgressCircle
                aria-label={liveColoredCircleLabel}
                colorVariant="50"
                colored
                done={isLiveDone}
                failed={isLiveFailed}
                percentage={livePercentage}
                process={isLiveProcessing}
              />
              <span className="text-body-small text-foreground-muted">
                {liveColoredCircleLabel}
              </span>
            </div>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title={t("componentShowcase.progress.standardTitle")}
        criterion={t("componentShowcase.progress.standardCriterion")}
      >
        <div className="w-full pb-2" data-testid="progress-bar-standard-showcase">
          <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
            {progressThemes.map((theme) => (
              <div
                key={theme.value}
                className="min-w-0 flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-base p-4"
              >
                <h3 className="text-heading-small font-display">
                  {t(progressThemeTranslationKeys[theme.key])}
                </h3>
                {progressLevels.map((level) => {
                  const colorToken = level.value === "None"
                    ? t("componentShowcase.progress.noFill")
                    : getProgressColorToken(theme.value, level.value);

                  return (
                    <div
                      key={level.value}
                      className="space-y-1"
                      data-testid={"progress-bar-" + theme.value.toLowerCase() + "-" + level.value.toLowerCase()}
                    >
                      <p className="flex items-center justify-between gap-2 text-body-small text-foreground-muted">
                        <span>{t(progressLevelTranslationKeys[level.key])} · {level.percentage}%</span>
                        <span className="font-mono">{colorToken}</span>
                      </p>
                      <ProgressBar
                        theme={theme.value}
                        progress={level.percentage}
                        statusLevel={level.value === "None" ? undefined : level.value}
                        text={t("componentShowcase.progress.label")}
                        aria-label={t("componentShowcase.progress.barSample", {
                          theme: t(progressThemeTranslationKeys[theme.key]),
                          level: t(progressLevelTranslationKeys[level.key]),
                          percentage: level.percentage,
                          color: colorToken,
                        })}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title={t("componentShowcase.progress.compactTitle")}
        criterion={t("componentShowcase.progress.compactCriterion")}
      >
        <div className="flex flex-wrap gap-4" data-testid="progress-bar-compact-showcase">
          {progressLevels.map((level) => {
            const colorToken = level.value === "None"
              ? t("componentShowcase.progress.noFill")
              : "progress-accent-fill";

            return (
              <div
                key={level.value}
                className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-base p-3"
                data-testid={"lesson-progress-" + level.value.toLowerCase()}
              >
                <p className="text-body-small text-foreground-muted">
                  {t(progressLevelTranslationKeys[level.key])} · {level.percentage}% · {colorToken}
                </p>
                <LessonProgressBar
                  progress={level.percentage}
                  text={t("componentShowcase.progress.label")}
                  aria-label={t("componentShowcase.progress.barSample", {
                    theme: t("componentShowcase.progress.theme.accent"),
                    level: t(progressLevelTranslationKeys[level.key]),
                    percentage: level.percentage,
                    color: colorToken,
                  })}
                />
              </div>
            );
          })}
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title={t("componentShowcase.progress.circleTitle")}
        criterion={t("componentShowcase.progress.circleCriterion")}
      >
        <div className="space-y-5" data-testid="progress-circle-showcase">
          {circleGroups.map((group) => (
            <section key={group.id} className="space-y-3">
              <h3 className="text-heading-small font-display">
                {t(circleStateTranslationKeys[group.titleKey])}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {group.samples.map((sample) => {
                  const percentage = sample.percentage;
                  const colorText = sample.colorToken ? " · " + sample.colorToken : "";
                  const ariaLabel = t("componentShowcase.progress.circleSample", {
                    state: t(circleStateTranslationKeys[sample.stateKey]),
                    percentage,
                    colorText,
                  });

                  return (
                    <div
                      key={sample.id}
                      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-base p-3"
                      data-testid={"progress-circle-" + sample.id}
                    >
                      <ProgressCircle
                        aria-label={ariaLabel}
                        process={sample.process}
                        colored={sample.colored}
                        done={sample.done}
                        failed={sample.failed}
                        percentage={sample.percentage}
                        colorVariant={sample.colorVariant}
                      />
                      <span className="text-body-small text-foreground-muted">{ariaLabel}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}