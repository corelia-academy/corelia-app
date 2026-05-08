import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, NavLink, useLocation } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  CreditCard,
  GraduationCap,
  IdCard,
  LogOut,
  MenuIcon,
  Search,
  Settings,
  UserCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import OpenCampusConnectDialog from "@/components/layouts/OpenCampusConnectDialog";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";

type SearchEntityType =
  | "project"
  | "contest"
  | "course"
  | "career_track"
  | "profile";

type SearchResultRow = {
  entity_type: SearchEntityType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  href: string;
  rank: number;
};

type TrendingSearchRow = {
  query: string;
  searches: number;
};

const RECENT_SEARCHES_KEY = "corelia.recentSearches.v1";
const MAX_RECENT_SEARCHES = 8;
const MAX_SUGGESTIONS = 8;

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function writeRecentSearches(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function addRecentSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  const curr = readRecentSearches();
  const next = [q, ...curr.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX_RECENT_SEARCHES,
  );
  writeRecentSearches(next);
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile, authInitialized, signOut, user } = useAuth();
  const { t } = useTranslation("common");
  const { t: tAccount } = useTranslation("account");
  const { isInitialized, authState, ocAuth } = useOCAuth();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [ocConnectOpen, setOcConnectOpen] = useState(false);
  const [ocConnectLoading, setOcConnectLoading] = useState(false);
  const [ocConnectError, setOcConnectError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResultRow[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [trending, setTrending] = useState<TrendingSearchRow[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const latestReqIdRef = useRef(0);

  const metaName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const metaAvatar =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user?.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null;

  const displayName = profile?.ocid
    ? profile.ocid
    : (profile?.full_name ?? metaName ?? profile?.id?.slice(0, 8) ?? t("user.fallbackName"));
  const avatarUrl = profile?.avatar_url ?? metaAvatar ?? undefined;
  const avatarFallback = (profile?.full_name ?? metaName ?? profile?.id ?? user?.id ?? "U").charAt(0);
  const isOcidConnected = Boolean(profile?.ocid);

  const accountDropdownItems = useMemo(
    () => [
      {
        to: profile?.username?.trim()
          ? `/u/${profile.username.trim()}`
          : profile?.ocid?.trim()
            ? `/u/${profile.ocid.trim()}`
            : profile?.id
              ? `/u/${profile.id}`
              : "/account",
        label: t("header.publicProfile"),
        icon: <UserCircle className="mr-2 size-4 shrink-0" aria-hidden />,
      },
      {
        to: "/account/profile",
        label: tAccount("nav.profile.title"),
        icon: <UserCircle className="mr-2 size-4 shrink-0" aria-hidden />,
      },
      ...(profile?.role === "instructor"
        ? [
            {
              to: "/account/instructor",
              label: tAccount("nav.instructor.title"),
              icon: (
                <GraduationCap className="mr-2 size-4 shrink-0" aria-hidden />
              ),
            },
          ]
        : []),
      {
        to: "/account/cv",
        label: tAccount("nav.cv.title"),
        icon: <IdCard className="mr-2 size-4 shrink-0" aria-hidden />,
      },
      {
        to: "/account/billing",
        label: tAccount("nav.billing.title"),
        icon: <CreditCard className="mr-2 size-4 shrink-0" aria-hidden />,
      },
      {
        to: "/account/settings",
        label: tAccount("nav.settings.title"),
        icon: <Settings className="mr-2 size-4 shrink-0" aria-hidden />,
      },
    ],
    [profile?.id, profile?.ocid, profile?.role, profile?.username, t, tAccount],
  );

  const ocConnectDisabled = useMemo(() => {
    if (!isInitialized) return true;
    if (!ocAuth) return true;
    return false;
  }, [isInitialized, ocAuth]);

  async function handleOcConnect() {
    setOcConnectError(null);
    try {
      if (ocConnectDisabled) return;
      setOcConnectLoading(true);
      await ocAuth!.signInWithRedirect({ state: "corelia-ocid-connect" });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : t("openCampusConnect.modal.startFailed");
      setOcConnectError(message);
      setOcConnectLoading(false);
    }
  }

  function handleOcLogoClick() {
    if (!isAuthenticated) return;
    if (isOcidConnected) {
      navigate("/account");
      return;
    }
    setOcConnectError(null);
    setOcConnectLoading(false);
    setOcConnectOpen(true);
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!searchWrapRef.current) return;
      if (!searchOpen) return;
      const target = e.target as Node | null;
      if (target && searchWrapRef.current.contains(target)) return;
      setSearchOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [searchOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadTrending() {
      try {
        const { data, error } = await supabase.rpc("list_trending_searches", {
          p_limit: 8,
        });
        if (error) throw new Error(error.message);
        if (cancelled) return;
        setTrending((data ?? []) as TrendingSearchRow[]);
      } catch {
        if (!cancelled) setTrending([]);
      }
    }
    void loadTrending();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = searchText.trim();
    setRecentSearches(readRecentSearches());
    if (!searchOpen) return;
    if (!q) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
      return;
    }

    const reqId = ++latestReqIdRef.current;
    setSuggestionsLoading(true);
    setSuggestionsError(null);

    const handle = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_public", {
          p_query: q,
          p_limit: MAX_SUGGESTIONS,
          p_offset: 0,
        });
        if (error) throw new Error(error.message);
        if (latestReqIdRef.current !== reqId) return;
        setSuggestions((data ?? []) as SearchResultRow[]);
      } catch (e) {
        if (latestReqIdRef.current !== reqId) return;
        setSuggestions([]);
        setSuggestionsError(e instanceof Error ? e.message : t("search.errors.loadFailed"));
      } finally {
        if (latestReqIdRef.current === reqId) setSuggestionsLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(handle);
    };
  }, [searchOpen, searchText, t]);

  async function handleSearchSubmit(query: string) {
    const q = query.trim();
    if (!q) return;
    addRecentSearch(q);
    setRecentSearches(readRecentSearches());
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
    if (isAuthenticated) {
      await supabase.rpc("log_search_query", { p_query: q });
    }
  }

  return (
    <header className="sticky top-0 z-40 flex w-full border-b border-border-subtle bg-card/95 backdrop-blur-md supports-backdrop-filter:bg-card/90">
      <div className="mx-auto flex h-14 w-full max-w-[1990px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="shrink-0 size-7">
            <MenuIcon className="size-5" aria-hidden />
          </SidebarTrigger>
          <NavLink
            to="/"
            className="flex h-10 items-center gap-2 text-sm font-medium"
          >
            <img
              src={
                isDarkMode
                  ? "/logo/corelia-full-logo-white.png"
                  : "/logo/corelia-full-logo-black.png"
              }
              alt="Corelia"
              className="h-9"
            />
          </NavLink>
        </div>

        <form
          className="hidden flex-1 items-center justify-center md:flex"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearchSubmit(searchText);
          }}
        >
          <div ref={searchWrapRef} className="relative w-full max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => {
                const hasAnything =
                  searchText.trim().length > 0 ||
                  readRecentSearches().length > 0 ||
                  trending.length > 0;
                setSearchOpen(hasAnything);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t("search.placeholder")}
              aria-label={t("search.placeholder")}
            />

            {searchOpen &&
            (searchText.trim().length > 0 ||
              recentSearches.length > 0 ||
              trending.length > 0 ||
              suggestionsLoading) ? (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-xl border border-border-subtle bg-card shadow-lg">
                <div className="max-h-[60vh] overflow-auto p-2">
                  {searchText.trim() ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/40"
                      onClick={() => void handleSearchSubmit(searchText)}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {t("search.suggest.searchFor", { query: searchText.trim() })}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t("search.suggest.enterToSeeAll")}
                        </div>
                      </div>
                      <Search className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  ) : null}

                  {!searchText.trim() ? (
                    <div className="grid gap-3 p-1">
                      {recentSearches.length ? (
                        <div>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                            {t("search.suggest.recent")}
                          </div>
                          <div className="grid">
                            {recentSearches.map((q) => (
                              <button
                                key={`recent:${q}`}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/40"
                                onClick={() => void handleSearchSubmit(q)}
                              >
                                <Search className="size-4 text-muted-foreground" aria-hidden />
                                <span className="truncate text-foreground">{q}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {trending.length ? (
                        <div>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                            {t("search.suggest.trending")}
                          </div>
                          <div className="grid">
                            {trending.map((row) => (
                              <button
                                key={`trend:${row.query}`}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/40"
                                onClick={() => void handleSearchSubmit(row.query)}
                              >
                                <Search className="size-4 text-muted-foreground" aria-hidden />
                                <span className="truncate text-foreground">{row.query}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : suggestionsLoading ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t("status.loading")}
                    </div>
                  ) : suggestionsError ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {suggestionsError}
                    </div>
                  ) : suggestions.length ? (
                    <div className="mt-1 grid">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        {t("search.suggest.suggestions")}
                      </div>
                      {suggestions.map((item) => (
                        <button
                          key={`${item.entity_type}:${item.entity_id}`}
                          type="button"
                          className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/40"
                          onClick={() => {
                            addRecentSearch(searchText.trim());
                            setRecentSearches(readRecentSearches());
                            setSearchOpen(false);
                            navigate(item.href);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {item.title}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="rounded-full border border-border-subtle bg-background/60 px-2 py-0.5">
                                {t(`search.group.${item.entity_type}` as never, {
                                  defaultValue: item.entity_type,
                                })}
                              </span>
                              {item.subtitle ? (
                                <span className="truncate">{item.subtitle}</span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      ))}

                      <button
                        type="button"
                        className="mt-1 flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
                        onClick={() => void handleSearchSubmit(searchText)}
                      >
                        {t("search.suggest.viewAllResults")}
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t("search.suggest.noQuickResults")}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </form>

        <div className="flex items-center gap-2">
          {!authInitialized ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-muted md:h-10" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={`inline-flex h-11 items-center gap-2 rounded-full border border-border-subtle pr-2 text-left text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 md:pr-3 ${
                        isOcidConnected
                          ? "bg-primary-container text-on-primary-container hover:bg-primary-container"
                          : "bg-card"
                      } cursor-pointer`}
                    >
                      <Avatar className="size-9">
                        <AvatarImage
                          src={avatarUrl}
                          alt={displayName}
                        />
                        <AvatarFallback>
                          {avatarFallback}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-48 truncate md:inline">
                        {displayName}
                      </span>
                    </button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="z-20 min-w-56 rounded-md border-border shadow-lg"
                >
                  {accountDropdownItems.map((item) => (
                    <DropdownMenuItem
                      key={item.to}
                      onClick={() => navigate(item.to)}
                      className="min-h-11 text-sm leading-relaxed"
                    >
                      {item.icon}
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void signOut().then(() => navigate("/login", { replace: true }))}
                    variant="destructive"
                    className="min-h-11 text-sm leading-relaxed"
                  >
                    <LogOut className="mr-2 size-4" aria-hidden />
                    {t("tabs.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {!isOcidConnected && (
                <button
                  type="button"
                  onClick={handleOcLogoClick}
                  className="hidden h-10 items-center justify-center gap-2 rounded-full border border-border-subtle bg-[#141bec] px-2.5 py-2 text-left text-sm cursor-pointer md:inline-flex"
                  aria-label={t("openCampusConnect.header.ariaLabel")}
                >
                  <img
                    src="/logo/OC-square-logo.svg"
                    alt="Open Campus"
                    className="h-6 rounded-full"
                  />
                  <span className="text-white">
                    Link <span className="font-bold">OCID</span>
                  </span>
                </button>
              )}

              <OpenCampusConnectDialog
                open={ocConnectOpen}
                onOpenChange={setOcConnectOpen}
                onConnect={() => void handleOcConnect()}
                disabled={ocConnectDisabled}
                loading={ocConnectLoading}
                error={ocConnectError ?? authState?.error?.message ?? null}
              />
            </div>
          ) : (
            <NavLink
              to="/login"
              state={{ from: location }}
              className="inline-flex items-center rounded-full border border-border-subtle bg-card/70 px-3 py-1.5 text-sm text-foreground shadow-card transition-colors hover:bg-card"
            >
              {t("tabs.signIn")}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
