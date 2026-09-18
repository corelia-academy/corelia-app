import { useRef, useState } from "react";
import { RadioGroup } from "@base-ui/react/radio-group";

import { Checkbox, CheckboxCard, Radio, RadioCard } from "@/components/ui/selection";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const selectionRows = [
  { id: "small", label: "Small", size: "small", disabled: false },
  { id: "disabled-small", label: "Disabled / Small", size: "small", disabled: true },
  { id: "large", label: "Large", size: "large", disabled: false },
  { id: "disabled-large", label: "Disabled / Large", size: "large", disabled: true },
] as const;
const checkboxStates = [
  { id: "normal", label: "Normal", controlLabel: "Unchecked", checked: false, indeterminate: false },
  { id: "active", label: "Active", controlLabel: "Checked", checked: true, indeterminate: false },
  { id: "indeterminate", label: "Indeterminate", controlLabel: "Indeterminate", checked: false, indeterminate: true },
] as const;
const radioStates = [
  { id: "normal", label: "Normal", controlLabel: "Unchecked", checked: false },
  { id: "active", label: "Active", controlLabel: "Checked", checked: true },
] as const;
const radioOptions = [
  { id: "free", label: "Free plan" },
  { id: "pro", label: "Pro plan" },
  { id: "plus", label: "Plus plan" },
] as const;
const cardSizes = [
  { id: "small", label: "Small", size: "small" },
  { id: "large", label: "Large", size: "large" },
] as const;
const cardStates = [
  { id: "default", label: "Default", controlLabel: "Unchecked", checked: false, disabled: false },
  { id: "selected", label: "Selected", controlLabel: "Checked", checked: true, disabled: false },
] as const;
const disabledCardStates = [
  { id: "disabled-default", label: "Default", controlLabel: "Unchecked", checked: false, disabled: true },
  { id: "disabled-selected", label: "Selected", controlLabel: "Checked", checked: true, disabled: true },
] as const;
const allCardStates = [...cardStates, ...disabledCardStates];
const cardOrientations = ["horizontal", "vertical"] as const;

type CheckboxMatrixValue = boolean | "indeterminate";
type CheckboxChildState = "normal" | "active";
type RadioCardGuard = {
  action: "select" | "deselect";
  cellId: string;
};

const checkboxMatrixInitialState = Object.fromEntries(
  selectionRows.flatMap((row) => [
    [`${row.id}-normal`, false],
    [`${row.id}-active`, true],
  ]),
) as Record<string, boolean>;
const radioMatrixInitialState = Object.fromEntries(
  selectionRows.flatMap((row) => radioStates.map((state) => [
    `${row.id}-${state.id}`,
    state.checked,
  ])),
) as Record<string, boolean>;
const checkboxCardMatrixInitialState = Object.fromEntries(
  cardOrientations.flatMap((orientation) => cardSizes.flatMap((size) => allCardStates.map((state) => [
    `${orientation}-${size.id}-${state.id}`,
    state.checked,
  ]))),
) as Record<string, boolean>;
const radioCardMatrixInitialState = Object.fromEntries(
  cardOrientations.flatMap((orientation) => cardSizes.flatMap((size) => {
    const groupId = `${orientation}-${size.id}`;

    return [
      [groupId, `${groupId}-selected`],
      [`${groupId}-disabled`, `${groupId}-disabled-selected`],
    ];
  })),
) as Record<string, string | undefined>;

type AdminSelectionComponentPageProps = {
  embedded?: boolean;
};

export default function AdminSelectionComponentPage({
  embedded = false,
}: AdminSelectionComponentPageProps) {
  const [checkboxMatrix, setCheckboxMatrix] = useState(checkboxMatrixInitialState);
  const [checkboxEvent, setCheckboxEvent] = useState("No checkbox interaction yet");
  const [checkboxCardMatrix, setCheckboxCardMatrix] = useState(checkboxCardMatrixInitialState);
  const [checkboxCardEvent, setCheckboxCardEvent] = useState("No checkbox card interaction yet");
  const [radioMatrix, setRadioMatrix] = useState(radioMatrixInitialState);
  const [radioMatrixEvent, setRadioMatrixEvent] = useState("No radio matrix interaction yet");
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [radioEvent, setRadioEvent] = useState("Selected plan: pro");
  const [radioCardMatrix, setRadioCardMatrix] = useState(radioCardMatrixInitialState);
  const [radioCardEvent, setRadioCardEvent] = useState("No radio card interaction yet");
  const radioCardSelectionGuard = useRef<Record<string, RadioCardGuard | undefined>>({});

  const getCheckboxAggregate = (rowId: string) => {
    const selectedCount = (["normal", "active"] as const).filter(
      (state) => checkboxMatrix[`${rowId}-${state}`],
    ).length;

    return {
      checked: selectedCount === 2,
      indeterminate: selectedCount === 1,
    };
  };

  const handleCheckboxChildChange = (rowId: string, state: CheckboxChildState, value: CheckboxMatrixValue) => {
    setCheckboxMatrix((current) => ({ ...current, [`${rowId}-${state}`]: value === true }));
    setCheckboxEvent(`${value === true ? "Selected" : "Cleared"} checkbox: ${rowId}-${state}`);
  };

  const handleCheckboxAggregateChange = (rowId: string, value: CheckboxMatrixValue) => {
    const nextValue = value === true;

    setCheckboxMatrix((current) => ({
      ...current,
      [`${rowId}-normal`]: nextValue,
      [`${rowId}-active`]: nextValue,
    }));
    setCheckboxEvent(`${nextValue ? "Selected" : "Cleared"} checkbox group: ${rowId}`);
  };

  const handleCheckboxCardMatrixChange = (cellId: string, value: CheckboxMatrixValue) => {
    setCheckboxCardMatrix((current) => ({ ...current, [cellId]: value === true }));
    setCheckboxCardEvent(`${value === true ? "Selected" : "Cleared"} checkbox card: ${cellId}`);
  };

  const handleRadioMatrixChange = (cellId: string) => {
    setRadioMatrix((current) => ({ ...current, [cellId]: true }));
    setRadioMatrixEvent(`Selected radio: ${cellId}`);
  };

  const handleRadioMatrixDeselect = (cellId: string) => {
    setRadioMatrix((current) => ({ ...current, [cellId]: false }));
    setRadioMatrixEvent(`Cleared radio: ${cellId}`);
  };

  const handleRadioOptionChange = (value: string) => {
    setSelectedPlan(value);
    setRadioEvent(`Selected plan: ${value}`);
  };

  const handleRadioCardMatrixChange = (groupId: string, cellId: string) => {
    const guard = radioCardSelectionGuard.current[groupId];

    if (guard?.action === "deselect" && guard.cellId === cellId) {
      delete radioCardSelectionGuard.current[groupId];
      return;
    }

    radioCardSelectionGuard.current[groupId] = { action: "select", cellId };
    queueMicrotask(() => {
      if (
        radioCardSelectionGuard.current[groupId]?.action === "select" &&
        radioCardSelectionGuard.current[groupId]?.cellId === cellId
      ) {
        delete radioCardSelectionGuard.current[groupId];
      }
    });
    setRadioCardMatrix((current) => ({ ...current, [groupId]: cellId }));
    setRadioCardEvent(`Selected radio card: ${cellId}`);
  };

  const handleRadioCardMatrixDeselect = (groupId: string, cellId: string) => {
    const guard = radioCardSelectionGuard.current[groupId];

    if (guard?.action === "select" && guard.cellId === cellId) {
      delete radioCardSelectionGuard.current[groupId];
      return;
    }

    radioCardSelectionGuard.current[groupId] = { action: "deselect", cellId };
    queueMicrotask(() => {
      if (
        radioCardSelectionGuard.current[groupId]?.action === "deselect" &&
        radioCardSelectionGuard.current[groupId]?.cellId === cellId
      ) {
        delete radioCardSelectionGuard.current[groupId];
      }
    });
    setRadioCardMatrix((current) => ({ ...current, [groupId]: undefined }));
    setRadioCardEvent(`Cleared radio card: ${cellId}`);
  };

  return (
    <ComponentShowcaseLayout
      title="Selection"
      description="Inspect checkbox, radio, selection card, focus, checked, indeterminate, and disabled states."
      embedded={embedded}
    >
      <ShowcaseSection title="Controls" criterion="Test standalone Checkbox states, then choose exactly one Radio option below it.">
        <div className="space-y-8">
          <section aria-labelledby="selection-checkbox-heading" className="space-y-4">
            <div>
              <h2 id="selection-checkbox-heading" className="text-title-medium text-foreground">Checkbox</h2>
              <p className="text-body-small text-foreground-muted">Click any enabled sample to toggle it; disabled samples remain unavailable.</p>
            </div>
            <div data-testid="selection-checkbox-reference" className="grid grid-cols-4 gap-3">
              <p className="text-body-small text-foreground-muted">Size</p>
              {checkboxStates.map((state) => (
                <p key={state.id} className="text-center text-body-small text-foreground-muted">
                  {state.label}
                </p>
              ))}
              {selectionRows.map((row) => (
                <div key={row.id} className="contents">
                  <p className="min-w-0 self-center text-body-small text-foreground-muted">{row.label}</p>
                  {checkboxStates.map((state) => {
                    const isAggregate = state.id === "indeterminate";
                    const aggregate = getCheckboxAggregate(row.id);

                    return (
                      <div key={`${row.id}-${state.id}`} data-testid={`selection-checkbox-state-${row.id}-${state.id}`} className="flex min-w-0 items-center justify-center border-b border-border-subtle py-3 last:border-b-0">
                        <Checkbox
                          checked={isAggregate ? aggregate.checked : checkboxMatrix[`${row.id}-${state.id}`] === true}
                          label={state.controlLabel}
                          disabled={row.disabled}
                          indeterminate={isAggregate ? aggregate.indeterminate : false}
                          onCheckedChange={(value) => {
                            if (isAggregate) {
                              handleCheckboxAggregateChange(row.id, value);
                              return;
                            }

                            handleCheckboxChildChange(row.id, state.id, value);
                          }}
                          size={row.size}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p role="status" className="text-body-small text-foreground-muted">{checkboxEvent}</p>
          </section>

          <section aria-labelledby="selection-radio-heading" className="space-y-4">
            <div>
              <h2 id="selection-radio-heading" className="text-title-medium text-foreground">Radio</h2>
              <p className="text-body-small text-foreground-muted">Inspect the Radio state reference, then choose one plan below; selecting another option moves the active state without allowing deselection.</p>
            </div>
            <div data-testid="selection-radio-reference" className="space-y-6">
              <div data-testid="selection-radio-matrix" className="grid grid-cols-3 gap-3">
                <p className="text-body-small text-foreground-muted">Size</p>
                {radioStates.map((state) => (
                  <p key={state.id} className="text-center text-body-small text-foreground-muted">
                    {state.label}
                  </p>
                ))}
                {selectionRows.map((row) => (
                  <div key={row.id} className="contents">
                    <p className="min-w-0 self-center text-body-small text-foreground-muted">{row.label}</p>
                    {radioStates.map((state) => {
                      const cellId = `${row.id}-${state.id}`;

                      return (
                        <div key={cellId} data-testid={`selection-radio-state-${cellId}`} className="flex min-w-0 items-center justify-center border-b border-border-subtle py-3 last:border-b-0">
                          <RadioGroup
                            key={`${cellId}-${radioMatrix[cellId] ? "selected" : "empty"}`}
                            defaultValue={radioMatrix[cellId] ? cellId : undefined}
                            onValueChange={() => handleRadioMatrixChange(cellId)}
                          >
                            <Radio
                              value={cellId}
                              label={state.controlLabel}
                              allowDeselect
                              disabled={row.disabled}
                              onDeselect={() => handleRadioMatrixDeselect(cellId)}
                              size={row.size}
                            />
                          </RadioGroup>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p role="status" className="text-body-small text-foreground-muted">{radioMatrixEvent}</p>

              <div>
                <h3 className="text-body-medium text-foreground">Plan options</h3>
                <p className="text-body-small text-foreground-muted">Choose one option; clicking the active option again keeps it selected.</p>
              </div>
              <div data-testid="selection-radio-options" className="w-full">
                <RadioGroup value={selectedPlan} onValueChange={handleRadioOptionChange}>
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                    {radioOptions.map((option) => (
                      <div key={option.id} data-testid={`selection-radio-option-${option.id}`} className="min-w-0 rounded-md border-b border-border-subtle py-3 last:border-b-0">
                        <Radio value={option.id} label={option.label} size="large" />
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              <p role="status" className="text-body-small text-foreground-muted">{radioEvent}</p>
            </div>
          </section>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Selection cards" criterion="Test CheckboxCard multi-selection and RadioCard single-selection together across Horizontal/Vertical, Small/Large, Default/Selected/Disabled.">
        <div data-testid="selection-card-reference" className="space-y-8">
          {cardOrientations.map((orientation) => (
            <section key={orientation} aria-labelledby={`selection-card-${orientation}-heading`} className="space-y-6">
              <div>
                <h2 id={`selection-card-${orientation}-heading`} className="text-title-medium text-foreground">
                  {orientation[0].toUpperCase() + orientation.slice(1)}
                </h2>
              </div>

              {cardSizes.map((cardSize) => {
                const groupId = `${orientation}-${cardSize.id}`;

                return (
                  <section key={cardSize.id} aria-labelledby={`selection-card-${groupId}-heading`} className="space-y-4">
                    <h3 id={`selection-card-${groupId}-heading`} className="text-label-large text-foreground">
                      {cardSize.label}
                    </h3>

                    <div className="space-y-3">
                      <p className="text-body-small text-foreground-muted">Checkbox</p>
                      <div data-testid={`selection-checkbox-card-grid-${groupId}`} className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {cardStates.map((state) => (
                            <p key={state.id} className="text-body-small text-foreground-muted">{state.label}</p>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {cardStates.map((state) => {
                            const cellId = `${groupId}-${state.id}`;

                            return (
                              <div key={state.id} data-testid={`selection-checkbox-card-state-${cellId}`} className="min-w-0">
                                <CheckboxCard
                                  label={state.controlLabel}
                                  supportingText="Supporting text for this selection"
                                  orientation={orientation}
                                  size={cardSize.size}
                                  checked={checkboxCardMatrix[cellId]}
                                  disabled={state.disabled}
                                  onCheckedChange={(value) => handleCheckboxCardMatrixChange(cellId, value)}
                                  showSupportingText
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div data-testid={`selection-checkbox-card-disabled-grid-${groupId}`} className="space-y-2 pt-2">
                          <p className="text-body-small text-foreground-muted">Disabled</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {disabledCardStates.map((state) => (
                              <p key={state.id} className="text-body-small text-foreground-muted">{state.label}</p>
                            ))}
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {disabledCardStates.map((state) => {
                              const cellId = `${groupId}-${state.id}`;

                              return (
                                <div key={state.id} data-testid={`selection-checkbox-card-state-${cellId}`} className="min-w-0">
                                  <CheckboxCard
                                    label={state.controlLabel}
                                    supportingText="Supporting text for this selection"
                                    orientation={orientation}
                                    size={cardSize.size}
                                    checked={checkboxCardMatrix[cellId]}
                                    disabled
                                    showSupportingText
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-body-small text-foreground-muted">Radio</p>
                      <div data-testid={`selection-radio-card-grid-${groupId}`} className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {cardStates.map((state) => (
                            <p key={state.id} className="text-body-small text-foreground-muted">{state.label}</p>
                          ))}
                        </div>
                        <RadioGroup
                          value={radioCardMatrix[groupId] ?? ""}
                          onValueChange={(value) => handleRadioCardMatrixChange(groupId, value)}
                        >
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {cardStates.map((state) => {
                              const cellId = `${groupId}-${state.id}`;

                              return (
                                <div
                                  key={state.id}
                                  data-testid={`selection-radio-card-state-${cellId}`}
                                  className="min-w-0"
                                >
                                  <RadioCard
                                    value={cellId}
                                    label={state.controlLabel}
                                    supportingText="Supporting text for this selection"
                                    orientation={orientation}
                                    size={cardSize.size}
                                    allowDeselect={radioCardMatrix[groupId] === cellId}
                                    disabled={state.disabled}
                                    onDeselect={
                                      radioCardMatrix[groupId] === cellId
                                        ? () => handleRadioCardMatrixDeselect(groupId, cellId)
                                        : undefined
                                    }
                                    showSupportingText
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </RadioGroup>

                        <div data-testid={`selection-radio-card-disabled-grid-${groupId}`} className="space-y-2 pt-2">
                          <p className="text-body-small text-foreground-muted">Disabled</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {disabledCardStates.map((state) => (
                              <p key={state.id} className="text-body-small text-foreground-muted">{state.label}</p>
                            ))}
                          </div>
                          <RadioGroup value={radioCardMatrix[`${groupId}-disabled`] ?? ""}>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              {disabledCardStates.map((state) => {
                                const cellId = `${groupId}-${state.id}`;

                                return (
                                  <div
                                    key={state.id}
                                    data-testid={`selection-radio-card-state-${cellId}`}
                                    className="min-w-0"
                                  >
                                    <RadioCard
                                      value={cellId}
                                      label={state.controlLabel}
                                      supportingText="Supporting text for this selection"
                                      orientation={orientation}
                                      size={cardSize.size}
                                      disabled
                                      showSupportingText
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </section>
          ))}
          <div className="space-y-1">
            <p role="status" className="text-body-small text-foreground-muted">{checkboxCardEvent}</p>
            <p role="status" className="text-body-small text-foreground-muted">{radioCardEvent}</p>
          </div>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
