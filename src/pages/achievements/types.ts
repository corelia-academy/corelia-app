export type ClaimStatus = "unclaimed" | "pending" | "claimed" | "failed";

export type CertificateItem = {
  id: string;
  courseId: string;
  title: string;
  course: string;
  issuedAt: string;
  instructor: string;
  type: "online" | "offline";
  credentialId: string;
  /** Ảnh chứng chỉ (placeholder nếu chưa có) */
  imageUrl?: string;
  // OpenCampus
  ocClaimStatus: ClaimStatus;
  ocCredentialId?: string | null;
  ocCredentialUrl?: string;
  ocHolderOcId?: string;
};

export type CredentialScopeForBadge = "course" | "hackathon" | "activity_milestone";

export type BadgeItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  earnedAt: string | null;
  locked: boolean;
  category: "learning" | "streak" | "milestone" | "social";
  /** Ảnh huy hiệu (placeholder nếu chưa có) */
  imageUrl?: string;
  // OpenCampus
  ocClaimStatus: ClaimStatus;
  ocTransactionHash?: string;
  ocCredentialUrl?: string;
  /** On-chain credential id when minted via Corelia credentials pipeline */
  mintCredentialId?: string | null;
  /** Scope grouping for Open Campus badges */
  credentialScope?: CredentialScopeForBadge;
  /** Role/type within a hackathon (e.g. "winner", "participant") — for multi-type hackathon badges */
  hackathonRole?: string | null;
};

export type ModalItem =
  | { kind: "cert"; data: CertificateItem }
  | { kind: "badge"; data: BadgeItem };
