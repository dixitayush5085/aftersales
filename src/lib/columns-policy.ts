import { ROLES, type ClientColumn, type ColumnVisibility, type ColumnValueType, type Role } from "@/types";

const allOn = (): ColumnVisibility => ({
  ADMIN: true,
  MANAGER: true,
  TEAM_LEAD: true,
  TEAM_MEMBER: true,
});

const allOff = (): ColumnVisibility => ({
  ADMIN: false,
  MANAGER: false,
  TEAM_LEAD: false,
  TEAM_MEMBER: false,
});

type BuiltinDef = {
  key: string;
  label: string;
  type: ColumnValueType;
  description: string;
  visible: ColumnVisibility;
  /** Roles whose visibility cannot be changed. */
  locked: Role[];
};

export const BUILTIN_COLUMNS: BuiltinDef[] = [
  {
    key: "name",
    label: "Client",
    type: "identity",
    description: "Name and company. Always visible so a row can be opened.",
    visible: allOn(),
    locked: [...ROLES],
  },
  {
    key: "contact",
    label: "Contact",
    type: "contact",
    description: "Mobile and email.",
    visible: allOn(),
    locked: [],
  },
  {
    key: "gst",
    label: "GST",
    type: "badge",
    description: "GST status from LMS.",
    visible: allOn(),
    locked: [],
  },
  {
    key: "planAmount",
    label: "Plan amount",
    type: "money",
    description: "Sale / plan value. Hide this for privacy on working roles.",
    visible: allOn(),
    locked: ["ADMIN"],
  },
  {
    key: "platforms",
    label: "Platforms",
    type: "platforms",
    description: "Amazon, Flipkart, Meesho progress.",
    visible: allOn(),
    locked: [],
  },
  {
    key: "owner",
    label: "Owner",
    type: "owner",
    description: "Assigned team member.",
    visible: allOn(),
    locked: [],
  },
  {
    key: "state",
    label: "State",
    type: "text",
    description: "State from LMS.",
    visible: allOff(),
    locked: [],
  },
  {
    key: "city",
    label: "City",
    type: "text",
    description: "City from LMS.",
    visible: allOff(),
    locked: [],
  },
  {
    key: "saleDate",
    label: "Sale date",
    type: "date",
    description: "When the lead converted.",
    visible: allOff(),
    locked: [],
  },
  {
    key: "sourceCode",
    label: "Source",
    type: "text",
    description: "LMS source code.",
    visible: allOff(),
    locked: [],
  },
];

export const BUILTIN_COLUMN_META = Object.fromEntries(
  BUILTIN_COLUMNS.map((col) => [col.key, col]),
) as Record<string, BuiltinDef>;

export function isColumnLocked(key: string, role: Role) {
  return BUILTIN_COLUMN_META[key]?.locked.includes(role) ?? false;
}

export function builtinSeed(): ClientColumn[] {
  return BUILTIN_COLUMNS.map((col, index) => ({
    key: col.key,
    label: col.label,
    kind: "builtin",
    type: col.type,
    sortOrder: index,
    visible: { ...col.visible },
  }));
}

/** Read column flags, including rows saved before Super Manager was removed. */
export function readColumnVisibility(raw?: Partial<Record<string, boolean>> | null): ColumnVisibility {
  const source = raw ?? {};
  const legacy = Object.prototype.hasOwnProperty.call(source, "SUPER_MANAGER");
  const teamLead = Object.prototype.hasOwnProperty.call(source, "TEAM_LEAD")
    ? Boolean(source.TEAM_LEAD)
    : legacy
      ? Boolean(source.MANAGER)
      : Boolean(source.TEAM_LEAD);
  return {
    ADMIN: Boolean(source.ADMIN),
    MANAGER: legacy ? Boolean(source.SUPER_MANAGER) : Boolean(source.MANAGER),
    TEAM_LEAD: teamLead,
    TEAM_MEMBER: Boolean(source.TEAM_MEMBER),
  };
}

export function mergeColumn(stored: ClientColumn, seed?: BuiltinDef): ClientColumn {
  if (!seed) return stored;
  const visible = { ...seed.visible, ...readColumnVisibility(stored.visible) };
  for (const role of seed.locked) {
    visible[role] = seed.visible[role];
  }
  return {
    ...stored,
    label: seed.label,
    kind: "builtin",
    type: seed.type,
    visible,
  };
}
