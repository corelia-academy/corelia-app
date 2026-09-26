import {
  isValidElement,
  useState,
  type ReactNode,
} from "react";

import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuSearch,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldContextReset } from "@/components/ui/field";
import {
  Input,
  type InputProps,
  type InputAccessoryState,
  type InputOption,
  type InputTagOption,
  type InputTagMenuState,
  type InputVariant,
} from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

import avatarSample from "@/assets/input-field/avatar-sample.png";

const phoneCodes: InputOption[] = [
  { value: "+91", label: "+91" },
  { value: "+1", label: "+1" },
  { value: "+84", label: "+84" },
];

const currencies: InputOption[] = [
  { value: "INR", label: "INR" },
  { value: "USD", label: "USD" },
  { value: "VND", label: "VND" },
];

const tagOptions: InputTagOption[] = [
  {
    value: "engineering",
    label: "Engineering",
    leadingVisual: (
      <img
        src={avatarSample}
        alt=""
        className="size-full rounded-full object-cover"
      />
    ),
  },
  {
    value: "design",
    label: "Design",
    leadingVisual: (
      <img
        src={avatarSample}
        alt=""
        className="size-full rounded-full object-cover"
      />
    ),
  },
  {
    value: "product",
    label: "Product",
    leadingVisual: (
      <img
        src={avatarSample}
        alt=""
        className="size-full rounded-full object-cover"
      />
    ),
  },
  {
    value: "research",
    label: "Research",
    leadingVisual: (
      <img
        src={avatarSample}
        alt=""
        className="size-full rounded-full object-cover"
      />
    ),
  },
  {
    value: "operations",
    label: "Operations",
    leadingVisual: (
      <img
        src={avatarSample}
        alt=""
        className="size-full rounded-full object-cover"
      />
    ),
  },
];

type InputShowcaseState =
  | "placeholder"
  | "filled"
  | "disabled"
  | "destructive-placeholder"
  | "destructive-filled";

type InputShowcaseVariant =
  | InputVariant
  | "leading-dropdown"
  | "trailing-dropdown";

function getLabelText(label: ReactNode): string {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }

  if (Array.isArray(label)) {
    return label.map(getLabelText).filter(Boolean).join(" ");
  }

  if (isValidElement<{ children?: ReactNode }>(label)) {
    return getLabelText(label.props.children);
  }

  return "";
}

function filterOptions<T extends InputOption>(
  options: readonly T[],
  search: string,
): readonly T[] {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) return options;

  return options.filter((option) =>
    `${getLabelText(option.label)} ${option.value}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

function InputShowcaseSelector({
  ariaLabel,
  options,
  side,
  disabled,
  invalid,
}: InputAccessoryState & {
  ariaLabel: string;
  options: readonly InputOption[];
  side: "leading" | "trailing";
}) {
  const { t } = useTranslation("common");
  const [value, setValue] = useState(() => options[0]?.value ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = filterOptions(options, search);
  const isLeading = side === "leading";

  return (
    <div
      className={cn(
        "flex h-full shrink-0 items-center",
        isLeading
          ? "border-r border-input-field-divider pr-lg mr-xs group-focus-within/input-field:border-input-field-divider-focus"
          : "border-l border-input-field-divider pl-lg ml-xs group-focus-within/input-field:border-input-field-divider-focus",
        invalid &&
          "border-input-field-error group-focus-within/input-field:border-input-field-error",
      )}
    >
      <DropdownMenu
        open={!disabled && menuOpen}
        onOpenChange={(open) => setMenuOpen(!disabled && open)}
      >
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={ariaLabel}
              disabled={disabled}
              className={cn(
                "inline-flex h-10 shrink-0 items-center rounded-sm bg-transparent p-0 text-body-large font-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-input-field-focus-ring disabled:cursor-not-allowed disabled:text-input-field-disabled-foreground",
                isLeading ? "gap-xs" : "gap-md",
              )}
            />
          }
        >
          <span className="max-w-32 truncate">
            {selectedOption?.label ?? value}
          </span>
          <span
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            className="inline-flex size-4 items-center justify-center select-none [&_*]:select-none [&>svg]:size-4"
          >
            <CaretDown
              aria-hidden="true"
              className={
                disabled
                  ? "text-input-field-disabled-icon"
                  : "text-foreground-tertiary"
              }
              size={16}
              weight="regular"
            />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent layout="multiple-list" className="w-max min-w-32">
          <DropdownMenuSearch>
            <FieldContextReset>
              <Input
                type="search"
                variant="icon-leading"
                disabled={disabled}
                leadingIconClassName="text-dropdown-supporting"
                statusIcon={null}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t("actions.search")}
                aria-label={t("combobox.searchLabel", { label: ariaLabel })}
                controlClassName="h-10 gap-sm rounded-lg border-dropdown-input-border bg-dropdown-surface px-md focus-within:ring-dropdown-focus"
                className="text-body-large text-dropdown-title placeholder:text-dropdown-supporting"
              />
            </FieldContextReset>
          </DropdownMenuSearch>
          <DropdownMenuList>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  disabled={disabled || option.disabled}
                  className="min-h-[42px] whitespace-nowrap"
                  onClick={() => setValue(option.value)}
                >
                  <DropdownMenuItemContent>
                    {option.label}
                  </DropdownMenuItemContent>
                </DropdownMenuItem>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-body-small text-dropdown-supporting">
                {t("combobox.emptyLabel")}
              </p>
            )}
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function InputShowcaseTagMenu({ menu }: { menu: InputTagMenuState }) {
  const { t } = useTranslation("common");
  const [search, setSearch] = useState("");
  const filteredOptions = filterOptions(menu.options, search);

  return (
    <DropdownMenu open={menu.open} onOpenChange={menu.onOpenChange}>
      <DropdownMenuTrigger
        render={menu.trigger}
        aria-label={menu.triggerAriaLabel}
      />
      <DropdownMenuContent
        layout="multiple-list"
        sideOffset={8}
        className="w-max min-w-32"
      >
        <DropdownMenuSearch>
          <FieldContextReset>
            <Input
              type="search"
              variant="icon-leading"
              disabled={menu.disabled}
              leadingIconClassName="text-dropdown-supporting"
              statusIcon={null}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder={t("actions.search")}
              aria-label={t("combobox.searchLabel", {
                label: t("combobox.tagsLabel"),
              })}
              controlClassName="h-10 gap-sm rounded-lg border-dropdown-input-border bg-dropdown-surface px-md focus-within:ring-dropdown-focus"
              className="text-body-large text-dropdown-title placeholder:text-dropdown-supporting"
            />
          </FieldContextReset>
        </DropdownMenuSearch>
        <DropdownMenuList>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={menu.selectedValues.includes(option.value)}
                disabled={menu.disabled || option.disabled}
                size="compact"
                className="whitespace-nowrap"
                onCheckedChange={(checked, eventDetails) => {
                  eventDetails.cancel();

                  const nextValues = checked
                    ? [...menu.selectedValues, option.value]
                    : menu.selectedValues.filter(
                        (value) => value !== option.value,
                      );

                  menu.onSelectedValuesChange(nextValues);
                }}
              >
                <DropdownMenuItemContent leading={option.leadingVisual}>
                  {option.label}
                </DropdownMenuItemContent>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-body-small text-dropdown-supporting">
              {t("combobox.emptyLabel")}
            </p>
          )}
        </DropdownMenuList>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const showcaseVariants: { value: InputShowcaseVariant; label: string }[] = [
  { value: "icon-leading", label: "Icon leading" },
  { value: "default", label: "Default" },
  { value: "tags", label: "Tags" },
  { value: "leading-dropdown", label: "Leading dropdown" },
  { value: "trailing-dropdown", label: "Trailing dropdown" },
];

const showcaseStates: { value: InputShowcaseState; label: string }[] = [
  { value: "placeholder", label: "Placeholder" },
  { value: "filled", label: "Filled" },
  { value: "disabled", label: "Disabled" },
  {
    value: "destructive-placeholder",
    label: "Destructive · Placeholder",
  },
  { value: "destructive-filled", label: "Destructive · Filled" },
];

const showcaseVariantLabels: Record<InputShowcaseVariant, string> = {
  default: "Default",
  "icon-leading": "Icon leading",
  tags: "Tags",
  "leading-dropdown": "Leading dropdown",
  "trailing-dropdown": "Trailing dropdown",
};

const showcaseStateLabels: Record<InputShowcaseState, string> = {
  placeholder: "Placeholder",
  filled: "Filled",
  disabled: "Disabled",
  "destructive-placeholder": "Destructive · Placeholder",
  "destructive-filled": "Destructive · Filled",
};

const placeholderByVariant: Record<InputShowcaseVariant, string> = {
  default: "Enter your email",
  "icon-leading": "Search courses",
  tags: "Choose teams",
  "leading-dropdown": "Enter phone number",
  "trailing-dropdown": "Enter sale amount",
};

const valueByVariant: Record<InputShowcaseVariant, string> = {
  default: "alex@example.com",
  "icon-leading": "Corelia courses",
  tags: "",
  "leading-dropdown": "9876543210",
  "trailing-dropdown": "3000",
};

const invalidValueByVariant: Record<InputShowcaseVariant, string> = {
  default: "not-an-email",
  "icon-leading": "Missing course",
  tags: "",
  "leading-dropdown": "123",
  "trailing-dropdown": "0",
};

const inputTypeByVariant: Record<
  InputShowcaseVariant,
  InputProps["type"]
> = {
  default: "email",
  "icon-leading": "search",
  tags: "text",
  "leading-dropdown": "tel",
  "trailing-dropdown": "text",
};

function isSaleAmountDraftAllowed(value: string, max: number): boolean {
  if (!/^-?\d*(?:\.\d*)?$/.test(value)) return false;

  const isIncompleteNumber =
    value === "" || value === "-" || value === "." || value === "-.";

  if (isIncompleteNumber) return true;

  const amount = Number(value);
  return Number.isFinite(amount) && amount <= max;
}

function getValueAfterInsertion(
  input: HTMLInputElement,
  insertedText: string,
): string {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;

  return input.value.slice(0, start) + insertedText + input.value.slice(end);
}

function InputShowcaseExample({
  variant,
  state,
}: {
  variant: InputShowcaseVariant;
  state: InputShowcaseState;
}) {
  const isDestructive =
    state === "destructive-placeholder" || state === "destructive-filled";
  const isDisabled = state === "disabled";
  const isPlaceholder =
    state === "placeholder" || state === "destructive-placeholder";
  const isFilled = !isPlaceholder;
  const saleAmountMax = 999_999_999.99;
  const [saleAmount, setSaleAmount] = useState(() =>
    state === "destructive-filled"
      ? invalidValueByVariant["trailing-dropdown"]
      : isFilled
        ? valueByVariant["trailing-dropdown"]
        : "",
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (state === "disabled") {
      return ["engineering", "design", "product"];
    }

    if (state === "filled" || state === "destructive-filled") {
      return ["engineering", "design", "product"];
    }

    return [];
  });

  const inputVariant: InputVariant =
    variant === "leading-dropdown" || variant === "trailing-dropdown"
      ? "default"
      : variant;

  const inputProps: InputProps = {
    variant: inputVariant,
    fieldType: "single-line",
    type: inputTypeByVariant[variant],
    inputMode: variant === "trailing-dropdown" ? "decimal" : undefined,
    maxLength: variant === "leading-dropdown" ? 10 : undefined,
    placeholder: placeholderByVariant[variant],
    value: variant === "trailing-dropdown" ? saleAmount : undefined,
    defaultValue:
      isFilled && variant !== "tags" && variant !== "trailing-dropdown"
        ? isDestructive
          ? invalidValueByVariant[variant]
          : valueByVariant[variant]
        : undefined,
    onBeforeInput:
      variant === "trailing-dropdown"
        ? (event) => {
            const inputEvent = event.nativeEvent as InputEvent;

            if (
              !inputEvent.inputType.startsWith("insert") ||
              inputEvent.data === null
            ) {
              return;
            }

            const nextValue = getValueAfterInsertion(
              event.currentTarget,
              inputEvent.data,
            );

            if (!isSaleAmountDraftAllowed(nextValue, saleAmountMax)) {
              event.preventDefault();
            }
          }
        : undefined,
    onPaste:
      variant === "trailing-dropdown"
        ? (event) => {
            const pastedText = event.clipboardData.getData("text");
            const nextValue = getValueAfterInsertion(
              event.currentTarget,
              pastedText,
            );

            if (!isSaleAmountDraftAllowed(nextValue, saleAmountMax)) {
              event.preventDefault();
            }
          }
        : undefined,
    onChange:
      variant === "trailing-dropdown"
        ? (event) => {
            const nextValue = event.currentTarget.value;

            if (isSaleAmountDraftAllowed(nextValue, saleAmountMax)) {
              setSaleAmount(nextValue);
            }
          }
        : undefined,
    className:
      variant === "trailing-dropdown"
        ? "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        : undefined,
    renderLeadingContent:
      variant === "leading-dropdown"
        ? (slotState) => (
            <InputShowcaseSelector
              {...slotState}
              ariaLabel="Country code"
              options={phoneCodes}
              side="leading"
            />
          )
        : undefined,
    renderTrailingContent:
      variant === "trailing-dropdown"
        ? (slotState) => (
            <InputShowcaseSelector
              {...slotState}
              ariaLabel="Currency"
              options={currencies}
              side="trailing"
            />
          )
        : undefined,
    tagOptions: variant === "tags" ? tagOptions : undefined,
    selectedTagValues: variant === "tags" ? selectedTags : undefined,
    onSelectedTagValuesChange:
      variant === "tags" ? setSelectedTags : undefined,
    renderTagMenu:
      variant === "tags"
        ? (menu) => <InputShowcaseTagMenu menu={menu} />
        : undefined,
    maxVisibleTags: variant === "tags" ? 1 : undefined,
  };

  return (
    <Field
      className="min-w-0"
      label={
        showcaseVariantLabels[variant] +
        " · " +
        showcaseStateLabels[state]
      }
      hint={
        isDestructive || variant === "tags"
          ? undefined
          : "Supporting text."
      }
      error={isDestructive ? "Enter a valid value." : undefined}
      disabled={isDisabled}
    >
      <Input {...inputProps} />
    </Field>
  );
}

type AdminInputFieldComponentPageProps = {
  embedded?: boolean;
};

export default function AdminInputFieldComponentPage({
  embedded = false,
}: AdminInputFieldComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Input Field"
      description="Review field variants, validation, character count, selectable tags, dropdown selectors, and icon slots."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Figma variants"
        criterion="All five field variants are shown in placeholder, filled, disabled, destructive placeholder, and destructive filled states. Use Tab to inspect focus."
      >
        <div className="space-y-6">
          {showcaseStates.map((state) => (
            <section key={state.value} className="space-y-4">
              <h3 className="text-body-small font-body text-foreground-muted">
                {state.label}
              </h3>
              <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {showcaseVariants.map((variant) => (
                  <InputShowcaseExample
                    key={variant.value}
                    variant={variant.value}
                    state={state.value}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Required and text input"
        criterion="Required marker and regular text input remain available as supporting field features."
      >
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <Field
            label="Required field"
            hint="Use the address connected to your account."
            required
          >
            <Input
              fieldType="auto-grow"
              inputMode="email"
              placeholder="Enter your email"
            />
          </Field>
          <Field label="Text input">
            <Input fieldType="auto-grow" defaultValue="Corelia learner" />
          </Field>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
