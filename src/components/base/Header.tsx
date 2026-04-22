import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../ui/dropdown-menu";
import { useTheme } from "next-themes";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "@/stores/authStore";
import { ShowForRole } from "@/components/auth/ShowForRole";
import { ShowForAuth } from "@/components/auth/ShowForAuth";
import { getRoleLabel } from "@/types/database";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Khoá học", href: "/courses" },
  { label: "Lớp học", href: "/cohorts" },
  { label: "Cuộc thi", href: "/contests" },
];

const Header = () => {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.full_name ?? profile?.id?.slice(0, 8) ?? "User";
  const email = profile ? "(đăng nhập bằng email)" : "";
  const avatarUrl = profile?.avatar_url ?? undefined;

  const handleSignOut = () => {
    void signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-card/95 backdrop-blur-md supports-backdrop-filter:bg-card/90">
      <div className="relative mx-auto flex h-14 w-full max-w-[1990px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/"
            className="group -ml-2 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 lg:gap-3"
          >
            <img
              src="/corelia_favicon.svg"
              alt="Corelia"
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="hidden truncate text-[13px] font-medium leading-tight text-foreground sm:block">
                  Corelia Academy
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/55 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-warning" />
                  <span className="uppercase">Beta</span>
                </span>
              </div>
            </div>
          </NavLink>
        </div>

        <nav className="hidden items-center gap-0.5 md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          <ShowForAuth>
            <NavLink
              to="/achievements"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`
              }
            >
              Thành tích
            </NavLink>
          </ShowForAuth>

          <ShowForRole roles={["instructor", "support_staff", "admin"]}>
            <NavLink
              to="/instructor/courses"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`
              }
            >
              Quản lý giảng dạy
            </NavLink>
          </ShowForRole>
          <ShowForRole roles={["admin", "support_staff"]}>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`
              }
            >
              Quản trị
            </NavLink>
          </ShowForRole>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="icon-lg" variant="ghost">
                    <Avatar>
                      <AvatarImage src={avatarUrl} alt={displayName} />
                      <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Button>
                }
              />
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {profile?.role ? getRoleLabel(profile.role) : email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    Tài khoản
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/account/billing")}
                  >
                    Thanh toán & Hoá đơn
                  </DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuLabel>Theme</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={theme ?? "system"}
                    onValueChange={setTheme}
                  >
                    <DropdownMenuRadioItem value="light">
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      System
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => void handleSignOut()}>
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              render={<NavLink to="/login" />}
              nativeButton={false}
              variant="default"
              size="sm"
            >
              Đăng nhập
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
