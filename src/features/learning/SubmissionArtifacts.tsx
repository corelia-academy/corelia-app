import { ARTIFACT_FIELDS, type ArtifactField } from "./types";
import { validArtifact } from "./validation";
import { useLearningTranslation } from "./useLearningTranslation";

export function SubmissionArtifacts({ artifacts }: { artifacts?: Partial<Record<ArtifactField, string>> }) {
  const { t } = useLearningTranslation();
  const fields = ARTIFACT_FIELDS.filter(field => typeof artifacts?.[field] === "string" && artifacts[field]?.trim());
  if (!fields.length) return null;
  return <dl className="mt-3 space-y-3 text-sm">
    {fields.map(field => {
      const value = artifacts![field]!;
      return <div key={field}>
        <dt className="font-medium">{t(`learning.artifacts.${field}`)}</dt>
        <dd className="whitespace-pre-wrap break-words text-foreground-muted">
          {field.endsWith("_url") && validArtifact(field, value)
            ? <a href={value} target="_blank" rel="noreferrer" className="text-primary underline">{value}</a>
            : value}
        </dd>
      </div>;
    })}
  </dl>;
}
