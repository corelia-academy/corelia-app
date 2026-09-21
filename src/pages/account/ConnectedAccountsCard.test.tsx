// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedAccountsCard } from "./ConnectedAccountsCard";

const mocks = vi.hoisted(() => ({
  identities: { data: [] as unknown[], isSuccess: true, isError: false, isPending: false, refetch: vi.fn() },
  wallets: { data: [] as unknown[], isSuccess: true, isError: false, isPending: false, refetch: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: string) => mocks[options as "identities" | "wallets"] }));
vi.mock("@/features/account/accountQueries", () => ({ connectedIdentitiesQueryOptions: () => "identities", connectedWalletsQueryOptions: () => "wallets" }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/auth", () => ({ connectAccountIdentity: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock("@/lib/walletConnections", () => ({
  availableSolanaWallets: () => [], injectedEthereumWallet: () => ({ id: "injected", name: "Example wallet", provider: {} }),
  connectEthereumWallet: vi.fn(), connectSolanaWallet: vi.fn(),
}));
vi.mock("@wallet-standard/app", () => ({ getWallets: () => ({ on: () => () => undefined }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
async function render(path = "/account/profile") {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><ConnectedAccountsCard /></MemoryRouter>));
}
beforeEach(() => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  for (const value of [mocks.identities, mocks.wallets]) Object.assign(value, { data: [], isSuccess: true, isError: false, isPending: false });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("connected accounts status", () => {
  it("shows linked account identity and wallet status without showing provider buttons until requested", async () => {
    mocks.identities.data = [{ provider: "github", identity_data: { user_name: "test-user" } }];
    mocks.wallets.data = [{ id: "wallet-1", chain: "ethereum", address: "0x1234" }];
    await render();
    expect(container.textContent).toContain("test-user");
    expect(container.textContent).toContain("xp.connections.walletCount");
    expect(container.textContent).toContain("0x1234");
    expect(container.textContent).not.toContain("xp.connections.connectGithub");
    expect(container.textContent).not.toContain("Example wallet");
    const add = [...container.querySelectorAll("button")].find(b => b.textContent === "xp.connections.addWallet")!;
    await act(async () => add.click());
    expect(container.textContent).toContain("Example wallet");
    expect(add.getAttribute("aria-expanded")).toBe("true");
  });
  it("does not call failed requests disconnected or offer a misleading connect action", async () => {
    for (const value of [mocks.identities, mocks.wallets]) Object.assign(value, { isSuccess: false, isError: true });
    await render();
    expect(container.textContent).toContain("xp.connections.loadFailed");
    expect(container.textContent).not.toContain("xp.connections.notConnected");
    expect(container.textContent).not.toContain("xp.connections.connectGoogle");
    expect(container.textContent).toContain("profile.retry");
  });
  it("distinguishes loading from disconnected", async () => {
    for (const value of [mocks.identities, mocks.wallets]) Object.assign(value, { isSuccess: false, isPending: true });
    await render();
    expect(container.textContent).toContain("xp.connections.loading");
    expect(container.textContent).not.toContain("xp.connections.notConnected");
    expect(container.textContent).not.toContain("xp.connections.chooseWallet");
  });
  it("keeps the OAuth error visible after cleaning callback parameters", async () => {
    await render("/account/profile?error=server_error&error_description=private-code");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("xp.connections.oauthFailed");
    expect(container.textContent).not.toContain("private-code");
  });
});
