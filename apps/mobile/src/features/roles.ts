/** Pure logic for the "Roles you do" screen: add, remove, main role, years, and the save body. */
export const MAX_ROLES = 8;

export type PickedRole = {
  code: string;
  title: string;
  department: string;
  years: number | null;
  primary: boolean;
};

export type RoleLite = { code: string; title: string; department_name: string };

export const YEARS_MAX = 60;

export function addRole(list: PickedRole[], role: RoleLite): PickedRole[] {
  if (list.some((r) => r.code === role.code) || list.length >= MAX_ROLES) return list;
  return [
    ...list,
    {
      code: role.code,
      title: role.title,
      department: role.department_name,
      years: null,
      // The first role someone adds is their main one until they say otherwise.
      primary: list.length === 0,
    },
  ];
}

export function removeRole(list: PickedRole[], code: string): PickedRole[] {
  const next = list.filter((r) => r.code !== code);
  if (next.length && !next.some((r) => r.primary)) next[0] = { ...next[0]!, primary: true };
  return next;
}

export function makePrimary(list: PickedRole[], code: string): PickedRole[] {
  return list.map((r) => ({ ...r, primary: r.code === code }));
}

export function setYears(list: PickedRole[], code: string, delta: number): PickedRole[] {
  return list.map((r) => {
    if (r.code !== code) return r;
    const base = r.years ?? 0;
    const years = Math.min(YEARS_MAX, Math.max(0, base + delta));
    return { ...r, years };
  });
}

export const toBody = (list: PickedRole[]) => ({
  roles: list.map((r) => ({
    role_code: r.code,
    years_experience: r.years,
    is_primary: r.primary,
  })),
});

export const yearsLabel = (years: number | null) =>
  years == null
    ? 'Experience not added'
    : years === 0
      ? 'Less than a year'
      : `${years} yr${years === 1 ? '' : 's'}`;
