import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";

/** Khung trang trong khu Cài đặt theo Figma: bề rộng 800px, tiêu đề 28px, các nhóm cách nhau 40px. */
export function SettingsPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="container-app pb-6 pt-4 sm:pb-8 sm:pt-12 lg:px-16!">
      <div className="flex w-full max-w-[800px] flex-col gap-12">
        <header className="flex flex-col gap-2">
          <h1 data-profile-title className="text-heading-large font-display text-foreground">{title}</h1>
          <p className="text-body-large text-settings-text">{subtitle}</p>
        </header>
        <div className="flex flex-col gap-10">{children}</div>
      </div>
    </div>
  );
}

/** Một nhóm: nhãn + đường kẻ, các dòng cách nhau 20px. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-5">
      <header className="flex flex-col gap-2.5">
        <h2 className="text-heading-medium font-display text-foreground-subtle">{title}</h2>
        <Separator className="border-stroke-divider" />
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

/** Một dòng: nhãn (kèm biểu tượng thông tin nếu có) và mô tả bên trái, điều khiển bên phải. */
export function SettingsRow({ title, leading, info, description, action }: { title: string; leading?: ReactNode; info?: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
      {/* Dưới 768px mọi điều khiển cùng xuống dưới chữ và canh phải; từ 768px mọi dòng cùng một hàng */}
      <div className="flex min-w-0 max-w-[520px] flex-col gap-2 md:flex-1">
        <div className="flex items-center gap-2">
          {leading}
          <p className="text-heading-medium font-display text-settings-text">{title}</p>
          {info}
        </div>
        {description ? <p className="break-words text-body-medium leading-[1.4] text-foreground-subtle">{description}</p> : null}
      </div>
      {action ? <div className="max-w-full shrink-0 self-end md:self-start [&_[data-slot=button]]:capitalize">{action}</div> : null}
    </div>
  );
}
