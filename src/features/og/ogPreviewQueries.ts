import { queryOptions } from "@tanstack/react-query";

export type OgEntity = "project" | "course" | "hackathon" | "profile";
export type OgPreviewMeta = {
  canonicalUrl: string;
  imageUrl: string;
  updatedAt: string;
  revision: string;
};

export function ogPreviewQueryOptions(entity: OgEntity, id: string) {
  const normalized = id.trim();
  return queryOptions({
    queryKey: ["og-preview", entity, normalized] as const,
    enabled: Boolean(normalized),
    queryFn: async (): Promise<OgPreviewMeta | null> => {
      const response = await fetch(`/api/og/${entity}/${encodeURIComponent(normalized)}/meta`, { cache: "no-store" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`OG metadata: ${response.status}`);
      return response.json() as Promise<OgPreviewMeta>;
    },
    staleTime: 0,
    retry: false,
  });
}

export async function probeOgImage(url: string): Promise<{ status: number; contentType: string | null }> {
  const response = await fetch(url, { method: "HEAD", cache: "no-store" });
  return { status: response.status, contentType: response.headers.get("Content-Type") };
}
