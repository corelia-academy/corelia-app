export type BlastSkipBreakdown = {
  optedOut: number;
  noEmail: number;
  duplicateEmail: number;
};

export type BlastRecipientSummary = {
  emails: string[];
  skipped: number;
  skippedBreakdown: BlastSkipBreakdown;
};

/**
 * Reconcile a blast's recipient total before it is sent to the provider.
 * `resolvedEmails` has one entry per opted-in recipient and uses an empty string
 * when that recipient has no usable email address.
 */
export function summarizeBlastRecipients(params: {
  totalRecipients: number;
  optedInRecipients: number;
  resolvedEmails: string[];
}): BlastRecipientSummary {
  const resolved = params.resolvedEmails.filter(Boolean);
  const emails = [...new Set(resolved)];
  const optedOut = Math.max(0, params.totalRecipients - params.optedInRecipients);
  const noEmail = Math.max(0, params.optedInRecipients - resolved.length);
  const duplicateEmail = Math.max(0, resolved.length - emails.length);

  return {
    emails,
    skipped: optedOut + noEmail + duplicateEmail,
    skippedBreakdown: { optedOut, noEmail, duplicateEmail },
  };
}
