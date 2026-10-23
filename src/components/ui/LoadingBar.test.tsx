// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"

const firstLoad = vi.hoisted(() => ({ settled: true }))
vi.mock("@/hooks/useFirstLoadSettled", () => ({ useFirstLoadSettled: () => firstLoad.settled }))

import { LoadingBar } from "./LoadingBar"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("LoadingBar", () => {
  it("uses the semantic end-color token while a query is fetching", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let resolveQuery!: (value: string) => void
    const pendingQuery = new Promise<string>((resolve) => {
      resolveQuery = resolve
    })
    const queryPromise = queryClient.fetchQuery({
      queryKey: ["loading-bar-token-test"],
      queryFn: () => pendingQuery,
    })
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <LoadingBar />
          </QueryClientProvider>,
        )
      })

      await act(async () => {
        await Promise.resolve()
      })

      const gradient = container.querySelector<HTMLElement>(".loading-bar-gradient")
      expect(gradient).not.toBeNull()
      expect(gradient?.className).toContain("to-loading-bar-end")
      expect(gradient?.className).not.toContain("to-blue-700")
    } finally {
      await act(async () => {
        resolveQuery("done")
        await queryPromise
      })
      await act(async () => root.unmount())
      queryClient.clear()
      container.remove()
    }
  })

  it("stays hidden during the first load", async () => {
    firstLoad.settled = false
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let resolveQuery!: (value: string) => void
    const queryPromise = queryClient.fetchQuery({
      queryKey: ["loading-bar-first-load-test"],
      queryFn: () => new Promise<string>((resolve) => { resolveQuery = resolve }),
    })
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(<QueryClientProvider client={queryClient}><LoadingBar /></QueryClientProvider>)
      })
      await act(async () => { await Promise.resolve() })
      expect(container.querySelector(".loading-bar-gradient")).toBeNull()
    } finally {
      await act(async () => {
        resolveQuery("done")
        await queryPromise
      })
      await act(async () => root.unmount())
      queryClient.clear()
      container.remove()
      firstLoad.settled = true
    }
  })
})
