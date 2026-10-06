import { SELECTION_MODES, type SelectionMode } from "./constants";

export interface TalentOptionView {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

export interface TalentGroupView {
  id: string;
  name: string | null;
  selectionMode: SelectionMode;
  minSelections: number;
  maxSelections: number;
  options: TalentOptionView[];
}

/** True when the options are alternatives: the player may NOT have them all active. */
export function isExclusiveChoice(group: Pick<TalentGroupView, "selectionMode" | "options">): boolean {
  return group.selectionMode === SELECTION_MODES.ONE_OF && group.options.length > 1;
}

/** Validates a selection against a group's rules; returns an error key or null. */
export function validateTalentSelection(group: TalentGroupView, selectedIds: string[]): "unknownOption" | "tooFew" | "tooMany" | null {
  const valid = new Set(group.options.map((o) => o.id));
  if (selectedIds.some((id) => !valid.has(id))) return "unknownOption";
  const unique = new Set(selectedIds).size;
  const max = group.selectionMode === SELECTION_MODES.ALL ? group.options.length : group.maxSelections;
  const min = group.selectionMode === SELECTION_MODES.ALL ? group.options.length : group.minSelections;
  if (unique < min) return "tooFew";
  if (unique > max) return "tooMany";
  return null;
}
