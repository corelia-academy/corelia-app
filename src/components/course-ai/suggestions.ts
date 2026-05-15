import type { TFunction } from "i18next";

import type { AssistantContext } from "@/components/course-ai/context";
import type { CoraLearningMemory } from "@/hooks/useCoraAI";

function normalizeStyleLabel(t: TFunction, style: string | null) {
  if (!style) return t("coraWidget.memory.styles.unknown");
  return t(`coraWidget.memory.styles.${style}`, {
    defaultValue: t("coraWidget.memory.styles.unknown"),
  });
}

function uniqueSuggestions(input: string[]) {
  return Array.from(new Set(input.map((item) => item.trim()).filter(Boolean)));
}

export function buildPersonalizedSuggestions(args: {
  t: TFunction;
  context: AssistantContext | "lesson";
  baseSuggestions: string[];
  learningMemory: CoraLearningMemory | null;
}) {
  const { t, context, baseSuggestions, learningMemory } = args;
  const weakTopic = learningMemory?.weakTopics[0]?.trim() || "";
  const strongTopic = learningMemory?.strongTopics[0]?.trim() || "";
  const style = normalizeStyleLabel(t, learningMemory?.learningStyle ?? null);

  const personalized: string[] = [];

  if (weakTopic) {
    if (context === "lesson") {
      personalized.push(t("coraWidget.personalizedSuggestions.lessonWeakStyle", { topic: weakTopic, style }));
      personalized.push(t("coraWidget.personalizedSuggestions.lessonWeakExample", { topic: weakTopic }));
    } else if (context === "courses" || context === "search" || context === "home") {
      personalized.push(t("coraWidget.personalizedSuggestions.courseWeakDiscover", { topic: weakTopic }));
      personalized.push(t("coraWidget.personalizedSuggestions.courseWeakNext", { topic: weakTopic }));
    } else if (context === "career") {
      personalized.push(t("coraWidget.personalizedSuggestions.careerWeak", { topic: weakTopic }));
    } else if (context === "hackathons" || context === "projects") {
      personalized.push(t("coraWidget.personalizedSuggestions.activityWeak", { topic: weakTopic }));
    } else if (context === "achievements" || context === "profile" || context === "account") {
      personalized.push(t("coraWidget.personalizedSuggestions.profileWeak", { topic: weakTopic }));
    }
  }

  if (strongTopic) {
    if (context === "lesson") {
      personalized.push(t("coraWidget.personalizedSuggestions.lessonStrongExpand", { topic: strongTopic }));
    } else if (context === "courses" || context === "search" || context === "home") {
      personalized.push(t("coraWidget.personalizedSuggestions.courseStrongNext", { topic: strongTopic }));
    } else if (context === "career") {
      personalized.push(t("coraWidget.personalizedSuggestions.careerStrong", { topic: strongTopic }));
    } else if (context === "hackathons" || context === "projects") {
      personalized.push(t("coraWidget.personalizedSuggestions.activityStrong", { topic: strongTopic }));
    } else if (context === "achievements" || context === "profile" || context === "account") {
      personalized.push(t("coraWidget.personalizedSuggestions.profileStrong", { topic: strongTopic }));
    }
  }

  if (!weakTopic && !strongTopic && learningMemory?.learningStyle) {
    if (context === "lesson") {
      personalized.push(t("coraWidget.personalizedSuggestions.lessonStyleOnly", { style }));
    } else {
      personalized.push(t("coraWidget.personalizedSuggestions.defaultStyleOnly", { style }));
    }
  }

  return uniqueSuggestions([...personalized, ...baseSuggestions]).slice(0, 3);
}
