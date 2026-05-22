"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

type Orientation = "horizontal" | "vertical";

type PanelDescriptor = {
  ref?: React.Ref<ResizablePanelHandle>;
  props: ResizablePanelProps;
};

type DragState = {
  handleIndex: number;
  startPosition: number;
  initialSizes: number[];
};

const STORAGE_PREFIX = "resizable-panels:";
const COLLAPSED_EPSILON = 0.01;

export type ResizablePanelHandle = {
  collapse: () => void;
  expand: () => void;
  getSize: () => number;
  isCollapsed: () => boolean;
};

export type ResizablePanelProps = {
  children?: React.ReactNode;
  className?: string;
  collapsedSize?: number;
  collapsible?: boolean;
  defaultSize?: number;
  maxSize?: number;
  minSize?: number;
  onCollapse?: () => void;
  onExpand?: () => void;
};

export const ResizablePanel = React.forwardRef<
  ResizablePanelHandle,
  ResizablePanelProps
>(function ResizablePanel() {
  return null;
});
ResizablePanel.displayName = "ResizablePanel";

type ResizableHandleProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean;
  withHandle?: boolean;
};

export const ResizableHandle = React.forwardRef<
  HTMLDivElement,
  ResizableHandleProps
>(function ResizableHandle() {
  return null;
});
ResizableHandle.displayName = "ResizableHandle";

type ResizablePanelGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  autoSaveId?: string;
  children?: React.ReactNode;
  orientation?: Orientation;
};

export function ResizablePanelGroup({
  autoSaveId,
  children,
  className,
  orientation = "horizontal",
  ...props
}: ResizablePanelGroupProps) {
  const groupRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const lastExpandedSizesRef = React.useRef<number[]>([]);
  const previousCollapsedStateRef = React.useRef<boolean[]>([]);

  const items = React.useMemo(() => {
    return React.Children.toArray(children).filter(React.isValidElement);
  }, [children]);

  const panels = React.useMemo(() => {
    return items
      .filter(isResizablePanelElement)
      .map((item) => ({
        ref: getElementRef(item),
        props: item.props,
      })) satisfies PanelDescriptor[];
  }, [items]);

  const panelIndexesByItem = React.useMemo(() => {
    return items.map((_, itemIndex) => {
      return items.slice(0, itemIndex + 1).filter(isResizablePanelElement).length - 1;
    });
  }, [items]);

  const [sizes, setSizes] = React.useState<number[]>(() =>
    buildInitialSizes(panels, autoSaveId),
  );

  React.useEffect(() => {
    const nextSizes = buildInitialSizes(panels, autoSaveId);
    lastExpandedSizesRef.current = nextSizes.map((size, index) =>
      isCollapsedSize(size, panels[index]?.props) ? 0 : size,
    );
    previousCollapsedStateRef.current = [];
    setSizes(nextSizes);
  }, [autoSaveId, panels]);

  React.useEffect(() => {
    panels.forEach((panel, index) => {
      if (!isCollapsedSize(sizes[index] ?? 0, panel.props)) {
        lastExpandedSizesRef.current[index] = sizes[index] ?? 0;
      }
    });

    if (autoSaveId && typeof window !== "undefined") {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${autoSaveId}`,
        JSON.stringify(sizes),
      );
    }

    const nextCollapsedState = panels.map((panel, index) =>
      isCollapsedSize(sizes[index] ?? 0, panel.props),
    );

    nextCollapsedState.forEach((collapsed, index) => {
      const previous = previousCollapsedStateRef.current[index];
      if (previous === collapsed) return;
      if (collapsed) {
        panels[index]?.props.onCollapse?.();
      } else {
        panels[index]?.props.onExpand?.();
      }
    });

    previousCollapsedStateRef.current = nextCollapsedState;
  }, [autoSaveId, panels, sizes]);

  React.useEffect(() => {
    panels.forEach((panel, index) => {
      assignPanelHandle(panel.ref, {
        collapse: () => {
          setSizes((current) => collapsePanel(current, panels, index));
        },
        expand: () => {
          setSizes((current) => expandPanel(current, panels, index, lastExpandedSizesRef));
        },
        getSize: () => sizes[index] ?? 0,
        isCollapsed: () => isCollapsedSize(sizes[index] ?? 0, panels[index]?.props),
      });
    });

    return () => {
      panels.forEach((panel) => assignPanelHandle(panel.ref, null));
    };
  }, [panels, sizes]);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      const groupElement = groupRef.current;
      if (!dragState || !groupElement) return;

      const groupSize =
        orientation === "horizontal"
          ? groupElement.getBoundingClientRect().width
          : groupElement.getBoundingClientRect().height;

      if (!groupSize) return;

      const currentPosition =
        orientation === "horizontal" ? event.clientX : event.clientY;
      const deltaSize =
        ((currentPosition - dragState.startPosition) / groupSize) * 100;

      setSizes(
        resizePanelsAtHandle(
          dragState.initialSizes,
          panels,
          dragState.handleIndex,
          deltaSize,
        ),
      );
    };

    const handlePointerUp = () => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      setSizes((current) =>
        snapPanelsAfterDrag(current, panels, dragState.handleIndex),
      );

      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [orientation, panels]);

  return (
    <div
      ref={groupRef}
      data-slot="resizable-panel-group"
      data-orientation={orientation}
      className={cn(
        "flex h-full w-full min-w-0 min-h-0",
        orientation === "horizontal" ? "flex-row" : "flex-col",
        className,
      )}
      {...props}
    >
      {items.map((item, itemIndex) => {
        const panelIndex = panelIndexesByItem[itemIndex] ?? -1;

        if (isResizablePanelElement(item)) {
          const size = sizes[panelIndex] ?? 0;
          const collapsed = isCollapsedSize(size, item.props);

          return (
            <div
              key={item.key ?? `panel-${itemIndex}`}
              data-slot="resizable-panel"
              data-collapsed={collapsed ? "" : undefined}
              className={cn("min-w-0 min-h-0 overflow-hidden", item.props.className)}
              style={{
                flexBasis: 0,
                flexGrow: size,
                flexShrink: 1,
              }}
            >
              {item.props.children}
            </div>
          );
        }

        if (isResizableHandleElement(item)) {
          const handleIndex = panelIndex;

          return (
            <div
              key={item.key ?? `handle-${itemIndex}`}
              ref={item.ref}
              role="separator"
              aria-orientation={orientation}
              data-slot="resizable-handle"
              data-orientation={orientation}
              className={cn(
                "group relative flex shrink-0 touch-none select-none items-center justify-center",
                orientation === "horizontal"
                  ? item.props.withHandle
                    ? "w-3 cursor-col-resize"
                    : "w-px cursor-col-resize"
                  : item.props.withHandle
                    ? "h-3 cursor-row-resize"
                    : "h-px cursor-row-resize",
                item.props.disabled && "pointer-events-none opacity-50",
                item.props.className,
              )}
              onPointerDown={(event) => {
                if (item.props.disabled) return;
                dragStateRef.current = {
                  handleIndex,
                  startPosition:
                    orientation === "horizontal" ? event.clientX : event.clientY,
                  initialSizes: sizes,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
              }}
            >
              <div
                className={cn(
                  "absolute rounded-full bg-border transition-colors group-hover:bg-border-strong",
                  orientation === "horizontal"
                    ? "left-1/2 h-full w-px -translate-x-1/2"
                    : "top-1/2 h-px w-full -translate-y-1/2",
                )}
              />
              {item.props.withHandle ? (
                <div className="relative z-10 flex size-6 items-center justify-center rounded-full border border-border bg-surface-base text-foreground-muted shadow-sm">
                  <GripVertical
                    className={cn(
                      "size-3.5",
                      orientation === "vertical" && "rotate-90",
                    )}
                    aria-hidden
                  />
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <React.Fragment key={item.key ?? `item-${itemIndex}`}>
            {item}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function isResizablePanelElement(
  item: React.ReactNode,
): item is React.ReactElement<ResizablePanelProps> & {
  ref?: React.Ref<ResizablePanelHandle>;
} {
  return React.isValidElement(item) && item.type === ResizablePanel;
}

function isResizableHandleElement(
  item: React.ReactNode,
): item is React.ReactElement<ResizableHandleProps> & {
  ref?: React.Ref<HTMLDivElement>;
} {
  return React.isValidElement(item) && item.type === ResizableHandle;
}

function getElementRef<T>(
  element: React.ReactElement,
): React.Ref<T> | undefined {
  return (element as React.ReactElement & { ref?: React.Ref<T> }).ref;
}

function assignPanelHandle(
  ref: React.Ref<ResizablePanelHandle> | undefined,
  handle: ResizablePanelHandle | null,
) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(handle);
    return;
  }
  (ref as React.MutableRefObject<ResizablePanelHandle | null>).current = handle;
}

function buildInitialSizes(
  panels: PanelDescriptor[],
  autoSaveId?: string,
) {
  const stored = autoSaveId ? readStoredSizes(autoSaveId, panels.length) : null;
  if (stored) return stored;

  const defaultSizes = panels.map(
    (panel) => panel.props.defaultSize ?? 100 / Math.max(panels.length, 1),
  );
  return normalizeSizes(defaultSizes);
}

function readStoredSizes(autoSaveId: string, panelCount: number) {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${autoSaveId}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== panelCount ||
      parsed.some((value) => typeof value !== "number" || value < 0)
    ) {
      return null;
    }
    return normalizeSizes(parsed);
  } catch {
    return null;
  }
}

function normalizeSizes(values: number[]) {
  if (values.length === 0) return values;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return values.map(() => 100 / values.length);
  }
  return values.map((value) => (value / total) * 100);
}

function isCollapsedSize(size: number, props?: ResizablePanelProps) {
  const collapsedSize = props?.collapsedSize ?? 0;
  return size <= collapsedSize + COLLAPSED_EPSILON;
}

function getExpandedMinSize(props?: ResizablePanelProps) {
  return props?.minSize ?? 10;
}

function getCollapsedSize(props?: ResizablePanelProps) {
  return props?.collapsedSize ?? 0;
}

function getMaxSize(props?: ResizablePanelProps) {
  return props?.maxSize ?? 100;
}

function collapsePanel(
  current: number[],
  panels: PanelDescriptor[],
  index: number,
) {
  const next = [...current];
  const panel = panels[index]?.props;
  if (!panel?.collapsible) return current;

  const collapsedSize = getCollapsedSize(panel);
  const currentSize = next[index] ?? 0;
  if (currentSize <= collapsedSize + COLLAPSED_EPSILON) return current;

  const freed = currentSize - collapsedSize;
  next[index] = collapsedSize;
  return addSizeToNeighbors(next, panels, index, freed);
}

function expandPanel(
  current: number[],
  panels: PanelDescriptor[],
  index: number,
  lastExpandedSizesRef: React.MutableRefObject<number[]>,
) {
  const next = [...current];
  const panel = panels[index]?.props;
  if (!panel) return current;

  if (!isCollapsedSize(next[index] ?? 0, panel)) {
    return current;
  }

  const desiredSize = clamp(
    lastExpandedSizesRef.current[index] || panel.defaultSize || getExpandedMinSize(panel),
    getExpandedMinSize(panel),
    getMaxSize(panel),
  );
  const grown = takeSizeFromNeighbors(next, panels, index, desiredSize);
  if (!grown) return current;
  return next;
}

function addSizeToNeighbors(
  next: number[],
  panels: PanelDescriptor[],
  index: number,
  freed: number,
) {
  const candidateIndexes = getNeighborIndexes(panels.length, index);
  if (candidateIndexes.length === 0 || freed <= 0) return next;

  next[candidateIndexes[0]] = (next[candidateIndexes[0]] ?? 0) + freed;
  return next;
}

function takeSizeFromNeighbors(
  next: number[],
  panels: PanelDescriptor[],
  index: number,
  desiredSize: number,
) {
  const candidateIndexes = getNeighborIndexes(panels.length, index);
  if (candidateIndexes.length === 0 || desiredSize <= 0) return false;

  let remaining = desiredSize;

  for (const candidateIndex of candidateIndexes) {
    const candidate = panels[candidateIndex]?.props;
    const currentSize = next[candidateIndex] ?? 0;
    const minSize = isCollapsedSize(currentSize, candidate)
      ? getCollapsedSize(candidate)
      : getExpandedMinSize(candidate);
    const available = Math.max(0, currentSize - minSize);
    const taken = Math.min(remaining, available);
    next[candidateIndex] = currentSize - taken;
    remaining -= taken;
    if (remaining <= COLLAPSED_EPSILON) break;
  }

  const applied = desiredSize - remaining;
  if (applied <= COLLAPSED_EPSILON) return false;

  next[index] = (next[index] ?? 0) + applied;
  return true;
}

function getNeighborIndexes(panelCount: number, index: number) {
  const neighbors: number[] = [];
  for (let offset = 1; offset < panelCount; offset += 1) {
    const right = index + offset;
    const left = index - offset;
    if (right < panelCount) neighbors.push(right);
    if (left >= 0) neighbors.push(left);
  }
  return neighbors;
}

function resizePanelsAtHandle(
  current: number[],
  panels: PanelDescriptor[],
  handleIndex: number,
  deltaSize: number,
) {
  const leftIndex = handleIndex;
  const rightIndex = handleIndex + 1;
  const leftPanel = panels[leftIndex]?.props;
  const rightPanel = panels[rightIndex]?.props;
  if (!leftPanel || !rightPanel) return current;

  const next = [...current];
  const pairTotal = (current[leftIndex] ?? 0) + (current[rightIndex] ?? 0);
  const leftCurrent = current[leftIndex] ?? 0;
  const rightCurrent = current[rightIndex] ?? 0;

  const leftMin = isCollapsedSize(leftCurrent, leftPanel)
    ? getCollapsedSize(leftPanel)
    : getExpandedMinSize(leftPanel);
  const rightMin = isCollapsedSize(rightCurrent, rightPanel)
    ? getCollapsedSize(rightPanel)
    : getExpandedMinSize(rightPanel);
  const leftMax = Math.min(getMaxSize(leftPanel), pairTotal - rightMin);
  const rightMax = Math.min(getMaxSize(rightPanel), pairTotal - leftMin);

  const minLeft = Math.max(leftMin, pairTotal - rightMax);
  const maxLeft = Math.min(leftMax, pairTotal - rightMin);

  const nextLeft = clamp(leftCurrent + deltaSize, minLeft, maxLeft);
  next[leftIndex] = nextLeft;
  next[rightIndex] = pairTotal - nextLeft;
  return next;
}

function snapPanelsAfterDrag(
  current: number[],
  panels: PanelDescriptor[],
  handleIndex: number,
) {
  const leftIndex = handleIndex;
  const rightIndex = handleIndex + 1;
  let next = [...current];

  next = snapPanelPair(next, panels, leftIndex, rightIndex);
  next = snapPanelPair(next, panels, rightIndex, leftIndex);

  return next;
}

function snapPanelPair(
  current: number[],
  panels: PanelDescriptor[],
  index: number,
  neighborIndex: number,
) {
  const panel = panels[index]?.props;
  const neighbor = panels[neighborIndex]?.props;
  if (!panel || !neighbor) return current;

  const next = [...current];
  const size = next[index] ?? 0;
  const minSize = getExpandedMinSize(panel);

  if (size <= COLLAPSED_EPSILON && panel.collapsible) {
    next[index] = getCollapsedSize(panel);
    return next;
  }

  if (size >= minSize || !panel.collapsible) return next;

  if (size <= minSize / 2) {
    const collapsedSize = getCollapsedSize(panel);
    const freed = size - collapsedSize;
    next[index] = collapsedSize;
    next[neighborIndex] = (next[neighborIndex] ?? 0) + freed;
    return next;
  }

  const needed = minSize - size;
  const neighborSize = next[neighborIndex] ?? 0;
  const neighborMin = isCollapsedSize(neighborSize, neighbor)
    ? getCollapsedSize(neighbor)
    : getExpandedMinSize(neighbor);
  const available = Math.max(0, neighborSize - neighborMin);
  const taken = Math.min(needed, available);

  next[index] = size + taken;
  next[neighborIndex] = neighborSize - taken;
  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
