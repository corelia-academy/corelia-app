export type ClaimStatus =
  | "unclaimed"
  | "pending"
  | "claimed"
  | "failed";

export type CertificateItem = {
  id: string;
  /** Null when the source course has been deleted. */
  courseId: string | null;
  title: string;
  course: string;
  issuedAt: string;
  instructor: string;
  type: "online" | "offline";
  credentialId: string;
  /** Ảnh chứng nhận (placeholder nếu chưa có) */
  imageUrl?: string;
  /** Vị trí tên học viên trên certificate (% từ trái, mặc định 50) */
  nameXPercent?: number;
  /** Vị trí tên học viên trên certificate (% từ trên, mặc định 50) */
  nameYPercent?: number;
  /** Tên học viên để overlay lên certificate */
  holderName?: string | null;
  /** Màu chữ tên học viên overlay (hex, mặc định "#000000") */
  nameColor?: string | null;
  /** Course có credential template on-chain đang hoạt động (OCA hoặc OCB). */
  hasOnchainCredentialTemplate: boolean;
  /** Template gắn với hành động claim/view trên card certificate. */
  onchainTemplateId?: string | null;
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
  /** Course id backing a standalone (no offchain certificate) credential —
   *  needed so handleClaim knows which course to check/mint for. */
  courseId?: string | null;
  templateId?: string | null;
  // OpenCampus
  ocClaimStatus: ClaimStatus;
  ocTransactionHash?: string;
  ocCredentialUrl?: string;
  /** On-chain credential id when minted via Corelia credentials pipeline */
  mintCredentialId?: string | null;
  /** Issuance row id from DB for retry operations */
  issuanceId?: string;
  /** Status of the credential issuance */
  status?: "pending" | "minted" | "failed" | "awaiting_holder_id";
  /** Scope grouping for Open Campus badges */
  credentialScope?: CredentialScopeForBadge;
  /** Role/type within a hackathon (e.g. "winner", "participant") — for multi-type hackathon badges */
  hackathonRole?: string | null;
  collectionSymbol?: "ocbadge" | null;
  /** Tiêu chuẩn Achievement Type (e.g. Badge, Award, CertificateOfCompletion) */
  achievementType?: string;
};

export type ModalItem =
  | { kind: "cert"; data: CertificateItem }
  | { kind: "badge"; data: BadgeItem };
