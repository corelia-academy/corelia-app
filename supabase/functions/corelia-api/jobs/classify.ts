import {
  CLEARLY_NON_TECH_TITLE,
  DOMAIN_PATTERNS,
  JOB_DOMAIN_SLUGS,
  JOB_ROLE_SLUGS,
  JOB_SKILL_ALIASES,
  JOB_SKILL_SLUGS,
  ROLE_PATTERNS,
} from "./registry.ts";
import type { JobClassification, NormalizedSourceJob } from "./types.ts";

export const CLASSIFIER_VERSION = "jobs-ai-2";
export const DETERMINISTIC_VERSION = "jobs-deterministic-1";
const OPENAI_TIMEOUT_MS = 30_000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(text: string, alias: string): boolean {
  const escaped = escapeRegExp(alias).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
}

function detectSkills(text: string): string[] {
  return Object.entries(JOB_SKILL_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => hasAlias(text, alias)))
    .map(([slug]) => slug);
}

function preferredSection(text: string): string {
  const match = text.match(/(?:preferred|nice to have|bonus|ideally|plus)\s*(?:qualifications?|skills?)?[:\s]([\s\S]{0,3000})/i);
  return match?.[1] ?? "";
}

function detectSeniority(text: string): string | null {
  if (/\b(intern|internship)\b/i.test(text)) return "intern";
  if (/\b(fresher|graduate|new grad)\b/i.test(text)) return "fresher";
  if (/\b(junior|entry[- ]level|associate)\b/i.test(text)) return "junior";
  if (/\b(principal|staff|lead)\b/i.test(text)) return "lead";
  if (/\b(director|head of)\b/i.test(text)) return "director";
  if (/\b(manager|management)\b/i.test(text)) return "manager";
  if (/\b(senior|sr\.?|expert)\b/i.test(text)) return "senior";
  if (/\b(mid[- ]level|intermediate)\b/i.test(text)) return "mid";
  return null;
}

function detectExperience(text: string): { min: number | null; max: number | null } {
  const range = text.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\+?\s*years?/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const minimum = text.match(/\b(?:at least\s*)?(\d{1,2})\+?\s*years?(?:\s+of)?\s+(?:professional\s+)?experience\b/i);
  return { min: minimum ? Number(minimum[1]) : null, max: null };
}

function detectLocation(location: string, text: string): Pick<JobClassification, "remoteType" | "countryCodes" | "regions" | "remoteEligibility"> {
  const combined = `${location}\n${text.slice(0, 2500)}`;
  const remoteType = /\bhybrid\b/i.test(combined)
    ? "hybrid"
    : /\b(remote|work from home|distributed)\b/i.test(combined)
      ? "remote"
      : location.trim()
        ? "onsite"
        : "unknown";
  const countryCodes: string[] = [];
  if (/\b(vietnam|viet nam|ho chi minh|hanoi|ha noi|danang|da nang)\b/i.test(combined)) countryCodes.push("VN");
  if (/\b(united states|usa|u\.s\.|new york|san francisco|california)\b/i.test(combined)) countryCodes.push("US");
  if (/\b(singapore)\b/i.test(combined)) countryCodes.push("SG");
  if (/\b(united kingdom|uk|london)\b/i.test(combined)) countryCodes.push("GB");
  if (/\b(canada|toronto|vancouver)\b/i.test(combined)) countryCodes.push("CA");
  const regions: string[] = [];
  if (/\b(apac|asia[- ]pacific|asia)\b/i.test(combined) || countryCodes.some((code) => ["VN", "SG"].includes(code))) regions.push("APAC");
  if (/\b(emea|europe)\b/i.test(combined) || countryCodes.includes("GB")) regions.push("EMEA");
  if (/\b(north america|americas?)\b/i.test(combined) || countryCodes.some((code) => ["US", "CA"].includes(code))) regions.push("AMER");
  const eligibility = remoteType === "remote"
    ? location.trim() || (/\b(worldwide|anywhere)\b/i.test(combined) ? "Worldwide" : null)
    : null;
  return { remoteType, countryCodes, regions, remoteEligibility: eligibility };
}

function factualSummary(job: NormalizedSourceJob): string {
  const firstSentence = job.descriptionPlain
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)[0]
    ?.trim();
  if (firstSentence && firstSentence.length >= 40) return firstSentence.slice(0, 320);
  return `${job.title} at ${job.companyName}${job.locationText ? ` in ${job.locationText}` : ""}.`;
}

export function classifyJobDeterministically(job: NormalizedSourceJob): JobClassification {
  const titleAndTags = `${job.title}\n${job.sourceTags.join(" ")}`;
  const fullText = `${titleAndTags}\n${job.descriptionPlain}`.slice(0, 30_000);
  const roleMatches = ROLE_PATTERNS.filter(([, pattern]) => pattern.test(titleAndTags)).map(([role]) => role);
  const primaryRole = roleMatches[0] ?? null;
  const domains = DOMAIN_PATTERNS.filter(([, pattern]) => pattern.test(fullText)).map(([domain]) => domain);
  if (domains.length === 0) domains.push("general-software");
  const allSkills = detectSkills(fullText);
  const preferredSkills = detectSkills(preferredSection(job.descriptionPlain));
  const preferredSet = new Set(preferredSkills);
  const requiredSkills = allSkills.filter((skill) => !preferredSet.has(skill));
  const seniority = detectSeniority(`${job.title}\n${job.descriptionPlain.slice(0, 5000)}`);
  const experience = detectExperience(job.descriptionPlain.slice(0, 8000));
  const location = detectLocation(job.locationText, job.descriptionPlain);
  const clearlyNonTech = CLEARLY_NON_TECH_TITLE.test(job.title);
  const technicalEvidence = Boolean(primaryRole || allSkills.length || /\b(code|software|data|cloud|security|api|developer|engineer)\b/i.test(fullText));
  const isRelevant = !clearlyNonTech && technicalEvidence;
  let qualityScore = 20;
  if (job.descriptionPlain.length >= 400) qualityScore += 25;
  else if (job.descriptionPlain.length >= 120) qualityScore += 12;
  if (job.locationText) qualityScore += 8;
  if (/^https:\/\//i.test(job.applyUrl)) qualityScore += 10;
  if (primaryRole) qualityScore += 12;
  if (allSkills.length) qualityScore += 10;
  if (job.postedAt) qualityScore += 5;
  if (job.employmentType) qualityScore += 5;
  if (job.salaryMin != null || job.salaryMax != null) qualityScore += 5;
  qualityScore = Math.min(100, qualityScore);
  return {
    isRelevant,
    primaryRole,
    roles: roleMatches,
    domains,
    requiredSkills,
    preferredSkills,
    seniority,
    experienceMinYears: experience.min,
    experienceMaxYears: experience.max,
    ...location,
    summary: factualSummary(job),
    qualityScore,
    confidence: clearlyNonTech ? 0.96 : primaryRole ? 0.72 : technicalEvidence ? 0.52 : 0.25,
    evidence: {
      role: primaryRole ? job.title : null,
      requiredSkills,
      preferredSkills,
      seniority: seniority ? job.title : null,
      experience: experience.min == null ? null : job.descriptionPlain.match(/.{0,60}\b\d{1,2}\+?\s*years?.{0,80}/i)?.[0] ?? null,
    },
    model: "deterministic",
    classifierVersion: DETERMINISTIC_VERSION,
  };
}

type OpenAiOptions = {
  apiKey?: string;
  model?: string;
  fetcher?: typeof fetch;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeQualityScore(value: unknown, fallback: number): number {
  const score = clampNumber(value, 0, 100, fallback);
  // Some models express an otherwise valid percentage as a 0..1 ratio even
  // when the JSON schema requests 0..100. Accept both representations so a
  // high-quality listing cannot be rejected solely because of scale.
  return score > 0 && score <= 1 ? score * 100 : score;
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function allowedList(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).filter((item) => allowed.includes(item))));
}

function assertAiClassificationShape(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("openai_invalid_output");
  const output = value as Record<string, unknown>;
  const arrayFields = ["roles", "domains", "required_skills", "preferred_skills", "country_codes", "regions"];
  const nullableStringFields = ["primary_role", "seniority", "remote_eligibility"];
  const nullableNumberFields = ["experience_min_years", "experience_max_years"];
  if (
    typeof output.is_relevant !== "boolean" ||
    typeof output.remote_type !== "string" ||
    typeof output.summary !== "string" ||
    typeof output.quality_score !== "number" ||
    typeof output.confidence !== "number" ||
    arrayFields.some((field) => !Array.isArray(output[field])) ||
    nullableStringFields.some((field) => output[field] !== null && typeof output[field] !== "string") ||
    nullableNumberFields.some((field) => output[field] !== null && typeof output[field] !== "number") ||
    !output.evidence || typeof output.evidence !== "object" || Array.isArray(output.evidence)
  ) {
    throw new Error("openai_invalid_output");
  }
}

function parseAiClassification(
  value: Record<string, unknown>,
  fallback: JobClassification,
  model: string,
): JobClassification {
  const roles = allowedList(value.roles, JOB_ROLE_SLUGS);
  const primaryRole = typeof value.primary_role === "string" && JOB_ROLE_SLUGS.includes(value.primary_role as typeof JOB_ROLE_SLUGS[number])
    ? value.primary_role
    : roles[0] ?? null;
  const requiredSkills = allowedList(value.required_skills, JOB_SKILL_SLUGS);
  const preferredSkills = allowedList(value.preferred_skills, JOB_SKILL_SLUGS)
    .filter((skill) => !requiredSkills.includes(skill));
  const remote = String(value.remote_type ?? "unknown");
  const experienceMinYears = nullableNumber(value.experience_min_years);
  const parsedExperienceMax = nullableNumber(value.experience_max_years);
  const experienceMaxYears = experienceMinYears != null && parsedExperienceMax != null && parsedExperienceMax < experienceMinYears
    ? null
    : parsedExperienceMax;
  return {
    isRelevant: value.is_relevant === true,
    primaryRole,
    roles: primaryRole && !roles.includes(primaryRole) ? [primaryRole, ...roles] : roles,
    domains: allowedList(value.domains, JOB_DOMAIN_SLUGS),
    requiredSkills,
    preferredSkills,
    seniority: ["intern", "fresher", "junior", "mid", "senior", "lead", "manager", "director", "executive"].includes(String(value.seniority))
      ? String(value.seniority)
      : null,
    experienceMinYears,
    experienceMaxYears,
    remoteType: ["remote", "hybrid", "onsite", "unknown"].includes(remote)
      ? remote as JobClassification["remoteType"]
      : fallback.remoteType,
    countryCodes: Array.isArray(value.country_codes) ? value.country_codes.map(String).map((item) => item.toUpperCase()).filter((item) => /^[A-Z]{2}$/.test(item)) : [],
    regions: Array.isArray(value.regions) ? value.regions.map(String).filter((item) => ["APAC", "EMEA", "AMER"].includes(item)) : [],
    remoteEligibility: typeof value.remote_eligibility === "string" && value.remote_eligibility.trim() ? value.remote_eligibility.trim() : null,
    summary: typeof value.summary === "string" && value.summary.trim() ? value.summary.trim().slice(0, 500) : fallback.summary,
    qualityScore: normalizeQualityScore(value.quality_score, fallback.qualityScore),
    confidence: clampNumber(value.confidence, 0, 1, fallback.confidence),
    evidence: value.evidence && typeof value.evidence === "object" && !Array.isArray(value.evidence)
      ? value.evidence as Record<string, unknown>
      : {},
    model,
    classifierVersion: CLASSIFIER_VERSION,
  };
}

export async function classifyJob(
  job: NormalizedSourceJob,
  options: OpenAiOptions = {},
): Promise<JobClassification> {
  const fallback = classifyJobDeterministically(job);
  if (!options.apiKey?.trim()) return fallback;
  const model = options.model?.trim() || "gpt-5.4-mini";
  const fetcher = options.fetcher ?? fetch;
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      is_relevant: { type: "boolean" },
      primary_role: { type: ["string", "null"], enum: [...JOB_ROLE_SLUGS, null] },
      roles: { type: "array", items: { type: "string", enum: JOB_ROLE_SLUGS } },
      domains: { type: "array", items: { type: "string", enum: JOB_DOMAIN_SLUGS } },
      required_skills: { type: "array", items: { type: "string", enum: JOB_SKILL_SLUGS } },
      preferred_skills: { type: "array", items: { type: "string", enum: JOB_SKILL_SLUGS } },
      seniority: { type: ["string", "null"], enum: ["intern", "fresher", "junior", "mid", "senior", "lead", "manager", "director", "executive", null] },
      experience_min_years: { type: ["number", "null"] },
      experience_max_years: { type: ["number", "null"] },
      remote_type: { type: "string", enum: ["remote", "hybrid", "onsite", "unknown"] },
      country_codes: { type: "array", items: { type: "string" } },
      regions: { type: "array", items: { type: "string", enum: ["APAC", "EMEA", "AMER"] } },
      remote_eligibility: { type: ["string", "null"] },
      summary: { type: "string" },
      quality_score: { type: "number", minimum: 0, maximum: 100 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      evidence: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: { type: ["string", "null"] },
          skills: { type: "array", items: { type: "string" } },
          seniority: { type: ["string", "null"] },
          experience: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
        },
        required: ["role", "skills", "seniority", "experience", "location"],
      },
    },
    required: [
      "is_relevant", "primary_role", "roles", "domains", "required_skills",
      "preferred_skills", "seniority", "experience_min_years", "experience_max_years",
      "remote_type", "country_codes", "regions", "remote_eligibility", "summary",
      "quality_score", "confidence", "evidence",
    ],
  };
  const input = JSON.stringify({
    title: job.title,
    company: job.companyName,
    location: job.locationText,
    employment_type: job.employmentType,
    salary: {
      min: job.salaryMin,
      max: job.salaryMax,
      currency: job.salaryCurrency,
      period: job.salaryPeriod,
    },
    source_tags: job.sourceTags,
    description: job.descriptionPlain.slice(0, 18_000),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "authorization": `Bearer ${options.apiKey.trim()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1800,
        instructions: "Classify a technology job for Corelia. Use only evidence present in the supplied job. Never invent skills, seniority, experience, salary, location, or eligibility. Put short exact source excerpts in evidence. If a field is unsupported, return null or an empty array.",
        input,
        text: { format: { type: "json_schema", name: "corelia_job_classification", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`openai_http_${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    let outputText = typeof payload.output_text === "string" ? payload.output_text : "";
    if (!outputText && Array.isArray(payload.output)) {
      for (const item of payload.output) {
        const content = (item as { content?: unknown }).content;
        if (!Array.isArray(content)) continue;
        const match = content.find((part) => (part as { type?: unknown }).type === "output_text") as { text?: unknown } | undefined;
        if (typeof match?.text === "string") {
          outputText = match.text;
          break;
        }
      }
    }
    if (!outputText) throw new Error("openai_empty_output");
    const parsed = JSON.parse(outputText) as unknown;
    assertAiClassificationShape(parsed);
    return parseAiClassification(parsed, fallback, model);
  } catch (error) {
    console.warn("[jobs.classify] AI fallback", error instanceof Error ? error.message : error);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
