import { Avatar as HumationAvatar } from "@humation/react";
import { getPartsForSlot } from "@humation/core";
import { CaretUpDown } from "@phosphor-icons/react";
import { RotateCcw, Shuffle } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { avatarAssets } from "@/lib/avatarAssets";
import { cn } from "@/lib/utils";
import { displayPart, useAvatarEditor } from "./useAvatarEditor";

const FIELD_CLASS =
  "flex h-10 w-full items-center gap-2 rounded-md border border-input-field-border bg-surface-base px-lg text-left text-body-large font-body text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-input-field-focus-ring";
const LABEL_CLASS = "text-label-medium font-body leading-[1.4] text-foreground-subtle";

// Thứ tự và cách ghép ô chọn với ô màu theo Figma "Chỉnh sửa avatar".
const PART_FIELDS: { slot: string; color?: string }[] = [
  { slot: "bottom" },
  { slot: "body", color: "clothes" },
  { slot: "head", color: "hair" },
  { slot: "item" },
  { slot: "glasses" },
];
// TODO(figma-avatar-bottom-color): Figma không có ô màu cho slot "bottom"; giá trị cũ vẫn được giữ.
const COLOR_FIELDS = ["background", "skin", "stroke"] as const;

/** Ô "Color Input" của Figma: khung viền tô màu đã chọn, bấm vào mở bộ chọn màu của trình duyệt. */
function ColorInput({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative block h-10 cursor-pointer rounded-md border border-input-field-border focus-within:ring-2 focus-within:ring-input-field-focus-ring",
        className,
      )}
      style={{ backgroundColor: value }}
    >
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}

/** Ô "Input field" dạng chọn của Figma: nhãn, ô có biểu tượng ⇅ bên phải, danh sách thả xuống. */
function PartSelect({
  slot,
  label,
  value,
  autoLabel,
  options,
  onChange,
}: {
  slot: string;
  label: string;
  value: string;
  autoLabel: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("account");
  const selected = options.find((option) => option.value === value)?.label ?? autoLabel;
  // "" là "Tự động theo mẫu"; hai mũi tên đổi tuần tự trong danh sách này, dừng ở đầu/cuối.
  const all = ["", ...options.map((option) => option.value)];
  const index = Math.max(0, all.indexOf(value));
  const step = (delta: number) => onChange(all[Math.min(all.length - 1, Math.max(0, index + delta))]);
  const arrowClass =
    "absolute left-0 h-1/2 w-full cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-input-field-focus-ring disabled:cursor-default";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span id={`avatar-${slot}-label`} className={LABEL_CLASS}>{label}</span>
      <div className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger
            id={`avatar-${slot}`}
            type="button"
            aria-labelledby={`avatar-${slot}-label`}
            className={cn(FIELD_CLASS, "pr-10")}
          >
            <span className="min-w-0 flex-1 truncate">{selected}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent layout="multiple-list" className="w-(--anchor-width) max-w-[calc(100vw-2rem)]">
            <DropdownMenuList>
              <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(String(next))}>
                <DropdownMenuRadioItem size="large" value="">
                  <DropdownMenuItemContent>{autoLabel}</DropdownMenuItemContent>
                </DropdownMenuRadioItem>
                {options.map((option) => (
                  <DropdownMenuRadioItem key={option.value} size="large" value={option.value}>
                    <DropdownMenuItemContent>{option.label}</DropdownMenuItemContent>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuList>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Icon/amount-adjust của Figma (Phosphor CaretUpDown duotone 20px). Nửa trên = mẫu trước, nửa dưới = mẫu kế tiếp;
            hai nút nằm cạnh nút mở danh sách (không lồng trong nút) */}
        <div className="absolute top-1/2 right-lg size-5 -translate-y-1/2">
          <CaretUpDown aria-hidden size={20} weight="duotone" className="pointer-events-none text-foreground" />
          <button type="button" aria-label={t("avatarEditor.previousOption")} disabled={index <= 0} onClick={() => step(-1)} className={cn(arrowClass, "top-0")} />
          <button type="button" aria-label={t("avatarEditor.nextOption")} disabled={index >= all.length - 1} onClick={() => step(1)} className={cn(arrowClass, "bottom-0")} />
        </div>
      </div>
    </div>
  );
}

export function AvatarEditorModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation("account");
  const editor = useAvatarEditor();
  const { config } = editor;

  async function handleSave() {
    if (await editor.save()) {
      onOpenChange(false);
      toast.success(t("avatarEditor.saved"));
    }
  }

  return (
    <Modal
      type="slot"
      open={open}
      onOpenChange={onOpenChange}
      title={t("avatarEditor.title")}
      description={t("avatarEditor.description")}
      cancelLabel={t("avatarEditor.cancel")}
      confirmLabel={editor.saving ? t("avatarEditor.saving") : t("avatarEditor.save")}
      confirmDisabled={editor.saving || !editor.ready}
      onConfirm={() => void handleSave()}
    >
      {editor.ready ? (
        <div className="flex flex-col gap-5">
          <div
            className="relative flex h-[188px] items-end justify-center overflow-hidden rounded-md"
            style={{ backgroundColor: editor.colorValue("background") }}
            aria-label={t("avatarEditor.preview")}
          >
            <div className="h-[164px] w-[164px]">
              <HumationAvatar
                assets={avatarAssets}
                seed={editor.effectiveSeed}
                selections={config.selections}
                colors={config.colors}
                background="transparent"
                size="100%"
                title={t("avatarEditor.preview")}
              />
            </div>
            <div className="absolute right-3 bottom-3 flex gap-1">
              <Button type="button" variant="cta" hierarchy="secondary" size="small" iconOnly aria-label={t("avatarEditor.randomize")} onClick={editor.randomize}>
                <Shuffle className="size-4" aria-hidden />
              </Button>
              <Button type="button" variant="cta" hierarchy="secondary" size="small" iconOnly aria-label={t("avatarEditor.reset")} onClick={editor.reset}>
                <RotateCcw className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-6">
            {PART_FIELDS.map(({ slot, color }) => (
              <div key={slot} className="flex items-end gap-[10px]">
                <PartSelect
                  slot={slot}
                  label={t(`avatarEditor.slots.${slot}` as "avatarEditor.slots.head")}
                  value={config.selections[slot] ?? ""}
                  autoLabel={t("avatarEditor.fromSeed")}
                  options={getPartsForSlot(avatarAssets, slot).map((part) => ({
                    value: part.name ?? part.id,
                    label: displayPart(part.name ?? part.id),
                  }))}
                  onChange={(next) => editor.setSlot(slot, next)}
                />
                {color ? (
                  <ColorInput
                    label={t(`avatarEditor.colorsBySlot.${color}` as "avatarEditor.colorsBySlot.hair")}
                    value={editor.colorValue(color)}
                    onChange={(next) => editor.setColor(color, next)}
                    className="w-10 shrink-0"
                  />
                ) : null}
              </div>
            ))}
            {COLOR_FIELDS.map((color) => (
              <div key={color} className="flex flex-col gap-2">
                <span className={LABEL_CLASS}>{t(`avatarEditor.colorsBySlot.${color}` as "avatarEditor.colorsBySlot.hair")}</span>
                <ColorInput
                  id={`color-${color}`}
                  label={t(`avatarEditor.colorsBySlot.${color}` as "avatarEditor.colorsBySlot.hair")}
                  value={editor.colorValue(color)}
                  onChange={(next) => editor.setColor(color, next)}
                />
              </div>
            ))}
          </div>

          {editor.error ? (
            <p role="alert" className="text-body-medium text-input-field-error">{editor.error}</p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/** Đường dẫn cũ `/settings/avatar`: hiển thị đúng modal trên, đóng thì quay lại hồ sơ. */
export function AvatarSettingsRoute() {
  const navigate = useNavigate();
  return <AvatarEditorModal open onOpenChange={(open) => { if (!open) navigate("/account/profile"); }} />;
}
