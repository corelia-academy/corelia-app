export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <img
        src="/logo/corelia-logo-black.svg"
        alt="Corelia"
        className="h-10 dark:hidden"
      />
      <img
        src="/logo/corelia-logo-white.svg"
        alt="Corelia"
        className="hidden h-10 dark:block"
      />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Đang bảo trì hệ thống
        </h1>
        <p className="max-w-sm text-sm text-foreground-muted">
          Corelia đang được nâng cấp. Chúng tôi sẽ trở lại sớm. Cảm ơn bạn đã kiên nhẫn chờ đợi!
        </p>
      </div>
    </div>
  );
}
