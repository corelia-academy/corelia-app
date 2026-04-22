import { useMemo, useState } from "react";
import { useAuth } from "@/stores/authStore";
import { Input } from "@/components/ui/input";
import type { PartnerProfileDocument } from "@/types/database";
import {
  Bank,
  CalendarDots,
  CreditCard,
  FileText,
  Receipt,
} from "@phosphor-icons/react";

function ExternalOnlyHint() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="rounded-2xl border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-5">
        Mục này chỉ hiển thị cho giảng viên đối tác bên ngoài.
      </div>
    </div>
  );
}

function DocumentPanel({
  title,
  description,
  countLabel,
  icon,
  children,
}: {
  title: string;
  description: string;
  countLabel: string;
  icon: React.ComponentType<{ className?: string; weight?: "duotone" }>;
  children: React.ReactNode;
}) {
  const Icon = icon;

  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">{title}</h2>
          <p className="mt-1.5 text-[14px] text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
          <Icon className="size-4 text-primary" weight="duotone" />
          {countLabel}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DocumentList({
  emptyLabel,
  rows,
  renderMeta,
}: {
  emptyLabel: string;
  rows: PartnerProfileDocument[];
  renderMeta?: (row: (typeof rows)[number]) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-muted/20 p-4 text-sm text-muted-foreground sm:p-5">
            {emptyLabel}
          </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((doc) => (
        <article
          key={doc.path}
          className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[15px] font-medium text-primary hover:underline"
              title={doc.name}
            >
              {doc.name}
            </a>
            {renderMeta ? (
              <div className="mt-1 text-[13px] text-muted-foreground">
                {renderMeta(doc)}
              </div>
            ) : null}
          </div>
          <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <CalendarDots className="size-4" weight="duotone" />
            {new Date(doc.uploaded_at).toLocaleDateString("vi-VN")}
          </div>
        </article>
      ))}
    </div>
  );
}

export function PartnerContractsPage() {
  const { profile } = useAuth();
  const rows = profile?.partner_contract_docs ?? [];

  if (profile?.instructor_origin !== "external") return <ExternalOnlyHint />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Tổng tài liệu
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {rows.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Nguồn cung cấp
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            Học vụ / Admin
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Trạng thái
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            Theo dõi tài liệu
          </p>
        </div>
      </div>

      <DocumentPanel
        title="Hợp đồng"
        description="Danh sách tài liệu hợp đồng do học vụ hoặc admin cung cấp cho giảng viên đối tác."
        countLabel={`${rows.length} tài liệu`}
        icon={FileText}
      >
        <DocumentList
          rows={rows}
          emptyLabel="Chưa có tài liệu hợp đồng."
          renderMeta={() => "Tài liệu hợp đồng đã được chia sẻ cho bạn."}
        />
      </DocumentPanel>
      </div>
    </div>
  );
}

export function PartnerInvoicesPage() {
  const { profile } = useAuth();
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const rows = useMemo(() => {
    return (profile?.partner_invoice_docs ?? []).filter((doc) => {
      const explicitMonth = (doc.invoice_month ?? "").trim();
      if (explicitMonth) return explicitMonth === monthFilter;
      const d = new Date(doc.uploaded_at);
      if (Number.isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }, [profile?.partner_invoice_docs, monthFilter]);

  if (profile?.instructor_origin !== "external") return <ExternalOnlyHint />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Tháng đang xem
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {monthFilter}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Số hoá đơn
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {rows.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Trạng thái
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            Đối soát theo kỳ
          </p>
        </div>
      </div>

      <DocumentPanel
        title="Hoá đơn"
        description="Lọc theo tháng để xem các file hoá đơn hoặc đối soát đã được chia sẻ cho bạn."
        countLabel={`${rows.length} tài liệu`}
        icon={Receipt}
      >
        <div className="mb-5 w-full max-w-xs">
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        </div>
        <DocumentList
          rows={rows}
          emptyLabel="Không có hoá đơn trong tháng đã chọn."
          renderMeta={(doc) => (
            <>
              {(doc.invoice_month ?? "").trim()
                ? `Tháng ${doc.invoice_month}`
                : "Không gắn tháng hoá đơn"}
              {doc.note ? ` · ${doc.note}` : ""}
            </>
          )}
        />
      </DocumentPanel>
      </div>
    </div>
  );
}

export function PartnerPaymentsPage() {
  const { profile } = useAuth();
  const transferInfo = (profile?.partner_transfer_info ?? "").trim();
  const bankName = (profile?.partner_bank_name ?? "").trim();
  const bankAccount = (profile?.partner_bank_account_number ?? "").trim();
  const bankHolder = (profile?.partner_bank_account_holder ?? "").trim();
  const bankNote = (profile?.partner_bank_transfer_note ?? "").trim();

  if (profile?.instructor_origin !== "external") return <ExternalOnlyHint />;

  const hasBankInfo = Boolean(bankName || bankAccount || bankHolder || bankNote);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Tài khoản ngân hàng
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {bankAccount || "Chưa có"}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Chủ tài khoản
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {bankHolder || "Chưa có"}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Hướng dẫn thanh toán
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {transferInfo ? "Đã cập nhật" : "Chưa có"}
          </p>
        </div>
      </div>

      <DocumentPanel
        title="Thanh toán"
        description="Thông tin chuyển khoản và ghi chú đối soát do học vụ hoặc admin cung cấp theo hợp đồng."
        countLabel={hasBankInfo ? "Sẵn sàng nhận thanh toán" : "Chưa đủ thông tin"}
        icon={CreditCard}
      >
        {hasBankInfo ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-foreground">
                <Bank className="size-4 text-primary" weight="duotone" />
                Thông tin chuyển khoản
              </div>
              <div className="grid gap-2 text-sm">
                {bankName ? (
                  <div>
                    <span className="text-muted-foreground">Ngân hàng:</span>{" "}
                    <span className="font-medium text-foreground">{bankName}</span>
                  </div>
                ) : null}
                {bankAccount ? (
                  <div>
                    <span className="text-muted-foreground">Số tài khoản:</span>{" "}
                    <span className="font-medium text-foreground">{bankAccount}</span>
                  </div>
                ) : null}
                {bankHolder ? (
                  <div>
                    <span className="text-muted-foreground">Chủ tài khoản:</span>{" "}
                    <span className="font-medium text-foreground">{bankHolder}</span>
                  </div>
                ) : null}
                {bankNote ? (
                  <div>
                    <span className="text-muted-foreground">Nội dung CK:</span>{" "}
                    <span className="text-foreground">{bankNote}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-foreground">
                <CreditCard className="size-4 text-primary" weight="duotone" />
                Ghi chú thêm
              </div>
              {transferInfo ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {transferInfo}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có ghi chú thanh toán bổ sung.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-muted/20 p-5 text-sm text-muted-foreground">
            Chưa có thông tin thanh toán.
          </div>
        )}
      </DocumentPanel>
      </div>
    </div>
  );
}
