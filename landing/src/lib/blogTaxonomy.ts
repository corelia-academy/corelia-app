export type BlogLocale = "vi" | "en";

export const BLOG_CATEGORY_KEYS = [
  "web3-blockchain-knowledge",
  "developer-roadmaps-tools",
  "projects-tutorials",
  "career-ecosystem-insights",
  "announcements-events",
  "community-success-stories",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORY_KEYS)[number];

export const BLOG_TAG_KEYS = [
  "web3",
  "blockchain-fundamentals",
  "smart-contracts",
  "dapp-development",
  "ecosystem",
  "evm",
  "move-language",
  "mentorship",
  "project-based",
  "tooling",
  "nft",
  "dao",
  "career-tips",
  "hackathon",
  "code-walkthrough",
] as const;

export type BlogTag = (typeof BLOG_TAG_KEYS)[number];

export type BlogMedia =
  | {
      type: "image";
      src: string;
      alt?: string;
      fit?: "cover" | "contain";
    }
  | {
      type: "youtube";
      url: string;
    };

const CATEGORY_LABELS: Record<BlogCategory, Record<BlogLocale, string>> = {
  "web3-blockchain-knowledge": {
    vi: "Kiến thức Web3 & Blockchain",
    en: "Web3 & Blockchain Knowledge",
  },
  "developer-roadmaps-tools": {
    vi: "Lộ trình & Công cụ",
    en: "Developer Roadmaps & Tools",
  },
  "projects-tutorials": {
    vi: "Dự án & Tutorials",
    en: "Projects & Tutorials",
  },
  "career-ecosystem-insights": {
    vi: "Nghề nghiệp & Hệ sinh thái",
    en: "Career & Ecosystem Insights",
  },
  "announcements-events": {
    vi: "Thông báo & Sự kiện",
    en: "Announcements & Events",
  },
  "community-success-stories": {
    vi: "Cộng đồng & Câu chuyện thành công",
    en: "Community & Success Stories",
  },
};

const TAG_LABELS: Partial<Record<BlogTag, Record<BlogLocale, string>>> = {
  web3: { vi: "Web3", en: "web3" },
  "blockchain-fundamentals": {
    vi: "Nền tảng blockchain",
    en: "blockchain fundamentals",
  },
  "smart-contracts": { vi: "Hợp đồng thông minh", en: "smart contracts" },
  "dapp-development": { vi: "Phát triển dApp", en: "dApp development" },
  ecosystem: { vi: "Hệ sinh thái", en: "ecosystem" },
  evm: { vi: "EVM", en: "EVM" },
  "move-language": { vi: "Ngôn ngữ Move", en: "Move language" },
  mentorship: { vi: "Mentorship", en: "mentorship" },
  "project-based": { vi: "Theo dự án", en: "project-based" },
  tooling: { vi: "Công cụ", en: "tooling" },
  nft: { vi: "NFT", en: "NFT" },
  dao: { vi: "DAO", en: "DAO" },
  "career-tips": { vi: "Mẹo nghề nghiệp", en: "career tips" },
  hackathon: { vi: "hackathon", en: "hackathon" },
  "code-walkthrough": { vi: "Phân tích code", en: "code walkthrough" },
};

export function blogCategoryLabel(locale: BlogLocale, category: BlogCategory) {
  return CATEGORY_LABELS[category]?.[locale] ?? category;
}

export function blogTagLabel(locale: BlogLocale, tag: string) {
  const key = tag as BlogTag;
  return TAG_LABELS[key]?.[locale] ?? tag;
}
