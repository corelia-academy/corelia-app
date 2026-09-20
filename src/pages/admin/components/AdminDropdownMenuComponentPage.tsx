import { Fragment, useMemo, useState, type ReactNode } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { AlertTriangle, Diamond, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItemContent,
  DropdownMenuLabel,
  DropdownMenuList,
  DropdownMenuSearch,
  DropdownMenuSelectAll,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

type AdminDropdownMenuComponentPageProps = {
  embedded?: boolean;
};

type BaseItemVariant = "default" | "warning";

/**
 * Cấu hình hành vi của toàn bộ card; không thay thế hành vi riêng của icon.
 *
 * cardAction: "checkbox"
 * - Bấm phần nội dung bất kỳ của card để chọn/bỏ chọn checkbox.
 * - Nếu card có caret mở rộng, caret vẫn mở/đóng độc lập trong vùng control.
 *
 * cardAction: "caret"
 * - Bấm phần nội dung bất kỳ của card để mở/đóng danh sách con.
 * - Checkbox vẫn chọn/bỏ chọn độc lập khi bấm đúng vùng checkbox.
 * - Nếu card không có children thì cardAction này không tạo ra hành vi mở rộng.
 *
 * cardAction: "none"
 * - Phần nội dung card không kích hoạt hành vi toàn card.
 * - Checkbox vẫn chọn/bỏ chọn riêng khi bấm vào checkbox.
 * - Caret vẫn mở/đóng riêng khi bấm vào vùng control của caret.
 * - "none" không có nghĩa là disabled, ẩn icon hoặc xóa hành vi của icon.
 */
type DropdownRowBehavior = {
  cardAction: "checkbox" | "caret" | "none";
};

const baseItemStatuses = [
  { id: "default", label: "Default" },
  { id: "hover", label: "Hover" },
  { id: "focus", label: "Focused" },
  { id: "selected", label: "Selected" },
  { id: "disabled", label: "Disabled" },
] as const;

const baseItemVariants = [
  { id: "default", label: "Default" },
  { id: "warning", label: "Warning" },
] as const satisfies readonly { id: BaseItemVariant; label: string }[];

const baseItemColumns = [
  { id: "no-leading", label: "Leading icon = No", showLeading: false },
  { id: "leading", label: "Leading icon = Yes", showLeading: true },
] as const;

type BaseItemPreviewProps = (typeof baseItemColumns)[number];

function BaseItemPreview({ id, label, showLeading }: BaseItemPreviewProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(["default-selected", "warning-selected"]),
  );

  const visibleGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return baseItemVariants
      .map((variant) => ({
        ...variant,
        statuses: baseItemStatuses.filter((status) =>
          `${variant.label} ${status.label}`.toLowerCase().includes(normalizedSearch),
        ),
      }))
      .filter((group) => group.statuses.length > 0);
  }, [search]);

  function updateSelected(itemId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }

      return next;
    });
  }

  return (
    <article
      data-testid={`dropdown-menu-base-items-${id}`}
      className="min-w-0 space-y-3"
    >
      <div>
        <h3 className="text-title-medium font-display">{label}</h3>
        <p className="mt-1 text-body-small text-foreground-muted">
          Default and Warning, each with five Figma states. Hover an enabled row or press Tab to inspect the real Hover and Focused states.
        </p>
      </div>

      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        modal={false}
        highlightItemOnHover={false}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              data-testid={`dropdown-menu-base-items-${id}-trigger`}
            >
              Open {label}
            </Button>
          }
        />
        <DropdownMenuContent
          layout="multiple-list"
          align="start"
          className="max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuSearch
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search states"
            aria-label={`Search ${label}`}
          />
          <DropdownMenuList className="gap-[18px]">
            {visibleGroups.map((group, groupIndex) => (
              <Fragment key={group.id}>
                {groupIndex > 0 ? (
                  <DropdownMenuSeparator className="my-0" />
                ) : null}
                <DropdownMenuGroup className="flex flex-col gap-px">
                  <DropdownMenuLabel className="px-lg py-0">
                    {group.label}
                  </DropdownMenuLabel>
                  {group.statuses.map((status) => {
                    const itemId = `${group.id}-${status.id}`;
                    const isDisabled = status.id === "disabled";

                    return (
                      <DropdownMenuCheckboxItem
                        key={itemId}
                        data-testid={`dropdown-menu-base-item-${id}-${itemId}`}
                        data-preview-state={status.id}
                        checked={selectedIds.has(itemId)}
                        disabled={isDisabled}
                        variant={group.id}
                        onCheckedChange={(checked) =>
                          updateSelected(itemId, checked === true)
                        }
                      >
                        <DropdownMenuItemContent
                          leading={
                            showLeading ? (
                              <Diamond
                                className="size-5 text-dropdown-supporting"
                                aria-hidden
                              />
                            ) : undefined
                          }
                          supportingText={`${status.label} state · ${showLeading ? "leading icon" : "no leading icon"}`}
                          trailingIcon={
                            <CaretDown
                              weight="duotone"
                              className="size-4"
                              aria-hidden
                            />
                          }
                        >
                          {status.label}
                        </DropdownMenuItemContent>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuGroup>
              </Fragment>
            ))}
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

type ShowcaseRow = {
  id: string;
  title: string;
  supportingText?: string;
  checked?: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  leading?: "user";
  trailing?: "caret" | "warning";
  expanded?: boolean;
  children?: readonly ShowcaseRow[];
  behavior: DropdownRowBehavior;
  variant?: BaseItemVariant;
  size: "compact" | "supporting" | "warning";
};

type UseCaseDefinition = {
  id: string;
  label: string;
  criterion: string;
  rows: readonly ShowcaseRow[];
  showSelectAll?: boolean;
  listClassName?: string;
  placement?: string;
};

const courseTitleRows: readonly ShowcaseRow[] = [
  {
    id: "discover",
    title: "Discover a variety of courses tailored to your interests.",
    checked: true,
    size: "compact",
    behavior: {
      // Toàn bộ card chọn/bỏ chọn; card này không có danh sách con.
      cardAction: "checkbox",
    },
  },
  {
    id: "participate",
    title: "Participate in engaging activities and real-world projects.",
    size: "compact",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "explore",
    title: "Explore in-depth subjects with professional insights.",
    checked: true,
    size: "compact",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "assess",
    title: "Assess your knowledge through interactive quizzes.",
    checked: true,
    size: "compact",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "certificate",
    title: "Receive a certificate after completing the course.",
    size: "compact",
    behavior: {
      cardAction: "checkbox",
    },
  },
];

const courseDetailRows: readonly ShowcaseRow[] = [
  {
    id: "discover",
    title: "Discover a variety of courses tailored to your interests.",
    supportingText: "Course topics and objectives.",
    checked: true,
    size: "supporting",
    behavior: {
      // Many single list / people-assignee: toàn bộ card là vùng chọn.
      cardAction: "checkbox",
    },
  },
  {
    id: "participate",
    title: "Participate in engaging activities and real-world projects.",
    supportingText: "Extra resources and support.",
    size: "supporting",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "explore",
    title: "Explore in-depth subjects with professional insights.",
    supportingText: "Resources for your learning.",
    checked: true,
    size: "supporting",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "assess",
    title: "Assess your knowledge through interactive quizzes.",
    supportingText: "Timely grading and feedback.",
    checked: true,
    size: "supporting",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "certificate",
    title: "Receive a certificate after completing the course.",
    supportingText: "Career-enhancing credentials.",
    size: "supporting",
    behavior: {
      cardAction: "checkbox",
    },
  },
];

const manySubRows: readonly ShowcaseRow[] = [
  {
    ...courseDetailRows[0],
    indeterminate: true,
    expanded: true,
    behavior: {
      // Sub-list parent: toàn card mở/đóng; checkbox vẫn chọn riêng.
      cardAction: "caret",
    },
    children: [courseDetailRows[1], courseDetailRows[2]],
  },
  {
    ...courseDetailRows[3],
    trailing: "caret",
    behavior: {
      // Caret trên Figma chỉ là icon minh họa vì row này không có children.
      cardAction: "checkbox",
    },
  },
  {
    ...courseDetailRows[4],
    trailing: "caret",
    behavior: {
      // Caret trên Figma chỉ là icon minh họa vì row này không có children.
      cardAction: "checkbox",
    },
  },
];

const peopleAssigneeRows: readonly ShowcaseRow[] = courseDetailRows.map((row) => ({
  ...row,
  leading: "user",
}));

const warningRows: readonly ShowcaseRow[] = [
  {
    id: "data-science",
    title: "Data Science Basics",
    supportingText: "Fundamentals of data analysis and visualization techniques.",
    checked: true,
    size: "warning",
    behavior: {
      // Warning case vẫn chọn theo toàn bộ card.
      cardAction: "checkbox",
    },
  },
  {
    id: "advanced-python",
    title: "Advanced Python Programming",
    supportingText: "Deep dive into Python's advanced features for software development.",
    size: "warning",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "ui-ux",
    title: "UI/UX Design Principles",
    supportingText: "Exploring user-centered design and prototyping methods.",
    checked: true,
    trailing: "warning",
    variant: "warning",
    size: "warning",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "project-management",
    title: "Project Management Essentials",
    supportingText: "Key strategies for effective project planning and execution.",
    checked: true,
    size: "warning",
    behavior: {
      cardAction: "checkbox",
    },
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity Fundamentals",
    supportingText: "Introduction to securing digital information and systems.",
    size: "warning",
    behavior: {
      cardAction: "checkbox",
    },
  },
];

const useCaseDefinitions: readonly UseCaseDefinition[] = [
  {
    id: "common-use",
    label: "Common use",
    criterion: "Five title-only selectable items with no leading or trailing icon.",
    placement: "xl:[grid-column-start:1] xl:[grid-row-start:1]",
    rows: courseTitleRows,
  },
  {
    id: "include-select-all",
    label: "Include Select All",
    criterion: "The same five title-only items with a real Select All control and divider.",
    showSelectAll: true,
    placement: "xl:[grid-column-start:2] xl:[grid-row-start:1]",
    rows: courseTitleRows,
  },
  {
    id: "many-single-list",
    label: "Dropdown with many single list",
    criterion: "Five supporting-text items with the list body constrained for scrolling.",
    placement: "xl:[grid-column-start:1] xl:[grid-row-start:2]",
    rows: courseDetailRows,
  },
  {
    id: "many-sub-list",
    label: "Dropdown with many sub-list",
    criterion: "One expanded parent with two indented child items in the same dropdown list.",
    placement: "xl:[grid-column-start:2] xl:[grid-row-start:2]",
    rows: manySubRows,
  },
  {
    id: "people-assignee",
    label: "Dropdown list type: people/assignee",
    criterion: "The same five supporting-text items with a 24px User icon before the content.",
    placement: "xl:[grid-column-start:3] xl:[grid-row-start:2]",
    rows: peopleAssigneeRows,
  },
  {
    id: "warning-case",
    label: "Warning case",
    criterion: "Five tall supporting-text items; only UI/UX Design Principles uses warning semantics.",
    listClassName: "!max-h-[370px]",
    placement: "xl:[grid-column-start:1] xl:[grid-row-start:3]",
    rows: warningRows,
  },
];

function flattenLeafRows(rows: readonly ShowcaseRow[]): ShowcaseRow[] {
  return rows.flatMap((row) => {
    if (row.children?.length) return flattenLeafRows(row.children);
    return [row];
  });
}

function collectCheckedIds(rows: readonly ShowcaseRow[]): string[] {
  return flattenLeafRows(rows)
    .filter((row) => row.checked)
    .map((row) => row.id);
}

function collectExpandedIds(rows: readonly ShowcaseRow[]): string[] {
  return rows.flatMap((row) => [
    ...(row.children?.length && row.expanded ? [row.id] : []),
    ...(row.children ? collectExpandedIds(row.children) : []),
  ]);
}

function filterRows(
  rows: readonly ShowcaseRow[],
  normalizedSearch: string,
): ShowcaseRow[] {
  if (!normalizedSearch) return [...rows];

  return rows.flatMap((row) => {
    const matchingChildren = row.children
      ? filterRows(row.children, normalizedSearch)
      : [];
    const matches = `${row.title} ${row.supportingText ?? ""}`
      .toLowerCase()
      .includes(normalizedSearch);

    if (!matches && matchingChildren.length === 0) return [];

    return [
      {
        ...row,
        children: matchingChildren,
      },
    ];
  });
}

function UseCaseDropdown({ definition }: { definition: UseCaseDefinition }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(collectCheckedIds(definition.rows)),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(collectExpandedIds(definition.rows)),
  );

  const visibleRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return normalizedSearch
      ? filterRows(definition.rows, normalizedSearch)
      : definition.rows;
  }, [definition.rows, search]);

  const selectableVisibleRows = flattenLeafRows(visibleRows).filter(
    (row) => !row.disabled,
  );
  const selectedVisibleCount = selectableVisibleRows.filter((row) =>
    selectedIds.has(row.id),
  ).length;
  const allVisibleSelected =
    selectableVisibleRows.length > 0 &&
    selectedVisibleCount === selectableVisibleRows.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const searchIsActive = search.trim().length > 0;

  function getRowLeafRows(row: ShowcaseRow) {
    if (row.children?.length) return flattenLeafRows(row.children);
    return [row];
  }

  function isRowChecked(row: ShowcaseRow) {
    const leafRows = getRowLeafRows(row);

    return row.children?.length
      ? leafRows.length > 0 && leafRows.every((leaf) => selectedIds.has(leaf.id))
      : selectedIds.has(row.id);
  }

  function isRowIndeterminate(row: ShowcaseRow) {
    if (!row.children) return row.indeterminate ?? false;
    if (row.children.length === 0) return false;

    const leafRows = getRowLeafRows(row);
    const selectedCount = leafRows.filter((leaf) =>
      selectedIds.has(leaf.id),
    ).length;

    return selectedCount > 0 && selectedCount < leafRows.length;
  }

  function updateRowSelection(row: ShowcaseRow, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const leaf of getRowLeafRows(row)) {
        if (checked) {
          next.add(leaf.id);
        } else {
          next.delete(leaf.id);
        }
      }

      return next;
    });
  }

  function updateVisibleRows(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const row of selectableVisibleRows) {
        if (checked) {
          next.add(row.id);
        } else {
          next.delete(row.id);
        }
      }

      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function renderRows(rows: readonly ShowcaseRow[], depth = 0): ReactNode[] {
    return rows.flatMap((row) => {
      const rowHasChildren = Boolean(row.children?.length);
      const cardAction = row.behavior.cardAction;
      const canExpand = rowHasChildren;
      const isExpanded =
        canExpand && (expandedIds.has(row.id) || searchIsActive);
      const caretIcon = isExpanded ? (
        <CaretUp weight="duotone" className="size-4" aria-hidden />
      ) : (
        <CaretDown weight="duotone" className="size-4" aria-hidden />
      );
      const trailingIcon =
        row.trailing === "warning" ? (
          <AlertTriangle
            data-testid={`dropdown-menu-warning-icon-${row.id}`}
            className="size-4 text-dropdown-warning"
            aria-hidden
          />
        ) : canExpand ? (
          <button
            type="button"
            data-testid={`dropdown-menu-caret-icon-${row.id}`}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${row.title}`}
            aria-expanded={isExpanded}
            className="flex size-full cursor-pointer items-center justify-end p-0"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded(row.id);
            }}
          >
            {caretIcon}
          </button>
        ) : row.trailing === "caret" ? (
          <span
            data-testid={`dropdown-menu-caret-icon-${row.id}`}
            className="flex size-4 items-center justify-center"
          >
            <CaretDown weight="duotone" className="size-4" aria-hidden />
          </span>
        ) : undefined;

      const rowClassName = cn(
        row.size === "compact" && "!min-h-[42px]",
        row.size === "warning" && "!min-h-[74px]",
        depth > 0 && "!pl-[20px]",
        cardAction === "caret" && canExpand && "cursor-pointer",
      );
      const itemContent = (
        <DropdownMenuItemContent
          leading={
            row.leading === "user" ? (
              <UserRound
                data-testid={`dropdown-menu-user-icon-${row.id}`}
                className="size-6 text-dropdown-supporting"
                aria-hidden
              />
            ) : undefined
          }
          supportingText={row.supportingText}
          trailingIcon={trailingIcon}
          trailingIconHitArea={canExpand ? "control" : "icon"}
          showTrailingIcon={trailingIcon != null}
        >
          {row.title}
        </DropdownMenuItemContent>
      );
      const rowElement = (
        <DropdownMenuCheckboxItem
          key={row.id}
          data-testid={`dropdown-menu-use-case-row-${definition.id}-${row.id}`}
          data-depth={depth}
          data-card-action={cardAction}
          checked={isRowChecked(row)}
          indeterminate={isRowIndeterminate(row)}
          disabled={row.disabled}
          variant={row.variant ?? "default"}
          selectionMode={cardAction === "checkbox" ? "full-row" : "checkbox-only"}
          className={rowClassName}
          onClick={
            cardAction === "caret" && canExpand
              ? (event) => {
                  const target = event.target;

                  if (
                    target instanceof Element &&
                    target.closest(
                      '[data-slot="dropdown-menu-checkbox-item-indicator"]',
                    )
                  ) {
                    return;
                  }

                  toggleExpanded(row.id);
                }
              : undefined
          }
          onCheckedChange={(checked) =>
            updateRowSelection(row, checked === true)
          }
        >
          {itemContent}
        </DropdownMenuCheckboxItem>
      );

      return [
        rowElement,
        ...(isExpanded && row.children
          ? renderRows(row.children, depth + 1)
          : []),
      ];
    });
  }

  return (
    <article
      data-testid={`dropdown-menu-use-case-${definition.id}`}
      className={cn("min-w-0 space-y-3", definition.placement)}
    >
      <div>
        <h3 className="text-title-medium font-display">{definition.label}</h3>
        <p className="mt-1 text-body-small text-foreground-muted">
          {definition.criterion}
        </p>
      </div>

      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        modal={false}
        highlightItemOnHover={false}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              data-testid={`dropdown-menu-use-case-${definition.id}-trigger`}
            >
              Open {definition.label}
            </Button>
          }
        />
        <DropdownMenuContent
          layout="multiple-list"
          align="start"
          className="!w-[386px] max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuSearch
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search"
            aria-label={`Search ${definition.label}`}
          />

          {definition.showSelectAll ? (
            <DropdownMenuSelectAll
              data-testid={`dropdown-menu-use-case-${definition.id}-select-all`}
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected}
              label="Select All"
              onCheckedChange={(checked) =>
                updateVisibleRows(checked === true)
              }
            />
          ) : null}

          <DropdownMenuList className={definition.listClassName}>
            {visibleRows.length > 0 ? (
              renderRows(visibleRows)
            ) : (
              <p className="px-3 py-6 text-center text-body-small text-dropdown-supporting">
                No items found
              </p>
            )}
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

export default function AdminDropdownMenuComponentPage({
  embedded = false,
}: AdminDropdownMenuComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Dropdown Menu"
      description="Inspect the Figma Base Items states and six Multiple Dropdown List use cases with exact content, selection, search, nested rows, and warning semantics."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Base Items"
        criterion="Two independent dropdowns reproduce the Figma Base Item reference: one without a leading icon and one with a leading icon. Each contains Default and Warning groups with Default, Hover, Focused, Selected, and Disabled states."
      >
        <div
          data-testid="dropdown-menu-base-items"
          className="grid min-w-0 gap-8 xl:grid-cols-2"
        >
          {baseItemColumns.map((column) => (
            <BaseItemPreview key={column.id} {...column} />
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Six Figma dropdown use cases"
        criterion="Each Figma use case is an independent closed-by-default dropdown with a search field. Open them separately to verify common use, Select All, long flat lists, nested lists, people/assignee content, and the Warning case."
      >
        <div
          data-testid="dropdown-menu-use-cases"
          className="grid min-w-0 gap-8 xl:grid-cols-3"
        >
          {useCaseDefinitions.map((definition) => (
            <UseCaseDropdown key={definition.id} definition={definition} />
          ))}
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
