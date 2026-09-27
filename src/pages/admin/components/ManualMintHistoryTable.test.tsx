// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { adminKeys } from "@/features/admin/adminQueries"
import type { ManualMintHistoryRow } from "@/lib/manualMintHistory"
import { ManualMintHistoryTable } from "./ManualMintHistoryTable"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ user: { id: "admin-test" } }),
}))

vi.mock("@/features/admin/adminQueries", () => {
  const manualMintHistory = (userId: string) => [
    "admin",
    userId,
    "manual-mint-history",
  ]

  return {
    adminKeys: { manualMintHistory },
    manualMintHistoryQueryOptions: (userId?: string) => ({
      queryKey: manualMintHistory(userId ?? "missing"),
      queryFn: async () => [],
      enabled: Boolean(userId),
    }),
  }
})

vi.mock("@/lib/manualMintHistory", () => ({
  listManualMintHistoryForAdmin: vi.fn().mockResolvedValue([]),
  retryManualGrant: vi.fn(),
  revokeManualGrant: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

function makeHistoryRow(
  id: string,
  status: ManualMintHistoryRow["status"],
  templateKind: ManualMintHistoryRow["templateKind"],
): ManualMintHistoryRow {
  return {
    id,
    templateId: `template-${id}`,
    templateName: `Badge ${id}`,
    templateImageUrl: "",
    templateKind,
    templateScope: "course",
    userId: "student-test",
    recipientName: "Nguyen Van A",
    recipientEmail: `${id}@example.com`,
    recipientOcid: null,
    recipientAvatarUrl: null,
    recipientAvatarSeed: null,
    grantedBy: "admin-test",
    granterName: "Admin",
    granterEmail: "admin@example.com",
    grantedReason: null,
    status,
    network: "staging",
    ocCredentialId: null,
    explorerUrl: null,
    mintedAt: null,
    createdAt: "2026-09-27T00:00:00.000Z",
    errorMessage: null,
    isGhost: false,
  }
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("ManualMintHistoryTable color tokens", () => {
  it("keeps the OCA, revoked, and pending states on their semantic tokens", async () => {
    const rows = [
      makeHistoryRow("pending-oca", "pending", "oca"),
      makeHistoryRow("revoked-ocb", "revoked", "ocb"),
    ]
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(adminKeys.manualMintHistory("admin-test"), rows)

    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <ManualMintHistoryTable />
          </QueryClientProvider>,
        )
      })

      const ocaRow = Array.from(container.querySelectorAll("tbody tr"))
        .find((row) => row.textContent?.includes("Badge pending-oca"))
      const ocaBadge = Array.from(ocaRow?.querySelectorAll("span") ?? [])
        .find((badge) => badge.textContent?.trim() === "OCA")
      expect(ocaBadge?.className).toContain("bg-mint-oca-badge-surface/15")
      expect(ocaBadge?.className).toContain("text-mint-oca-badge-text")
      expect(ocaBadge?.className).toContain("border-mint-oca-badge-border/20")

      const revokedRow = Array.from(container.querySelectorAll("tbody tr"))
        .find((row) => row.textContent?.includes("manualMint.history.statusRevoked"))
      const revokedBadge = Array.from(revokedRow?.querySelectorAll("span") ?? [])
        .find((badge) => badge.textContent?.trim() === "manualMint.history.statusRevoked")
      expect(revokedBadge?.className).toContain("bg-mint-revoked-badge-surface/10")
      expect(revokedBadge?.className).toContain("text-mint-revoked-badge-text")
      expect(revokedBadge?.className).toContain("border-mint-revoked-badge-border/20")

      const pendingFilter = Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("manualMint.history.statusPending"))
      expect(pendingFilter).toBeDefined()
      await act(async () => pendingFilter?.click())

      expect(pendingFilter?.className).toContain("text-mint-pending-filter-text")
      const pendingCount = pendingFilter?.querySelector("span.rounded-full")
      expect(pendingCount?.className).toContain("bg-mint-pending-count-surface/20")
      expect(pendingCount?.className).toContain("text-mint-pending-count-text")
    } finally {
      await act(async () => root.unmount())
      queryClient.clear()
      container.remove()
    }
  })
})
