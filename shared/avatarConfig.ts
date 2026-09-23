export type AvatarConfig = {
  selections: Record<string, string>;
  colors: Record<string, string>;
};

type AvatarManifest = {
  selectionSlots: Array<{ id: string }>;
  colors: Array<{ id: string; allowTransparent?: boolean }>;
  parts: Array<{ id: string; name?: string; selectionSlot: string }>;
};

export const EMPTY_AVATAR_CONFIG: AvatarConfig = { selections: {}, colors: {} };

export function parseAvatarConfig(value: unknown, manifest: AvatarManifest): AvatarConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid avatar config");
  const input = value as Record<string, unknown>;
  const selections = input.selections;
  const colors = input.colors;
  if (!selections || typeof selections !== "object" || Array.isArray(selections) ||
      !colors || typeof colors !== "object" || Array.isArray(colors)) throw new Error("Invalid avatar config");
  if (JSON.stringify(value).length > 4096) throw new Error("Avatar config too large");

  const selected: Record<string, string> = {};
  for (const [slot, part] of Object.entries(selections)) {
    if (!manifest.selectionSlots.some((entry) => entry.id === slot) || typeof part !== "string") throw new Error("Invalid avatar part");
    const found = manifest.parts.find((entry) => entry.selectionSlot === slot && (entry.name === part || entry.id === part));
    if (!found) throw new Error("Invalid avatar part");
    selected[slot] = found.name ?? found.id;
  }
  const normalizedColors: Record<string, string> = {};
  for (const [slot, color] of Object.entries(colors)) {
    const definition = manifest.colors.find((entry) => entry.id === slot);
    if (!definition || typeof color !== "string") throw new Error("Invalid avatar color");
    if (color === "transparent" && definition.allowTransparent) {
      normalizedColors[slot] = color;
    } else if (/^#?[0-9a-fA-F]{6}$/.test(color)) {
      normalizedColors[slot] = `#${color.replace(/^#/, "").toUpperCase()}`;
    } else {
      throw new Error("Invalid avatar color");
    }
  }
  return { selections: selected, colors: normalizedColors };
}

export function safeAvatarConfig(value: unknown, manifest: AvatarManifest): AvatarConfig {
  try { return parseAvatarConfig(value ?? EMPTY_AVATAR_CONFIG, manifest); }
  catch { return EMPTY_AVATAR_CONFIG; }
}
