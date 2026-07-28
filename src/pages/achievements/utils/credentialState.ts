import type { ClaimStatus } from "../types";

export type IssuanceStateInput = {
  status: string;
  ocCredentialId?: string | null;
  errorMessage?: string | null;
};

export function claimStatusFromIssuance({
  status,
  ocCredentialId,
  errorMessage,
}: IssuanceStateInput): ClaimStatus {
  if (errorMessage === "awaiting_holder_id") return "awaiting_holder_id";
  if (status === "minted") {
    return ocCredentialId?.trim() ? "claimed" : "needs_reconciliation";
  }
  if (status === "failed") return "failed";
  return "pending";
}

export type SavedCourseIssuance = {
  templateId: string | null;
  status: string;
  oc_credential_id?: string | null;
  error_message?: string | null;
};

/** Failed issuance rows may use a replaced template; pending or minted rows
 * must remain attached to their original template to avoid duplicate claims. */
export function shouldUseSavedCourseIssuance(
  savedIssuance: SavedCourseIssuance | undefined,
  activeTemplateId: string | undefined,
): boolean {
  if (!savedIssuance || !activeTemplateId) return Boolean(savedIssuance);
  if (savedIssuance.templateId === activeTemplateId) return true;
  return claimStatusFromIssuance({
    status: savedIssuance.status,
    ocCredentialId: savedIssuance.oc_credential_id,
    errorMessage: savedIssuance.error_message,
  }) !== "failed";
}
