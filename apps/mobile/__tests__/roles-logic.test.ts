import {
  MAX_ROLES,
  addRole,
  makePrimary,
  removeRole,
  setYears,
  toBody,
  yearsLabel,
  type PickedRole,
} from '../src/features/roles';

const role = (n: number) => ({
  code: `HC-${String(n).padStart(4, '0')}`,
  title: `Role ${n}`,
  department_name: 'Dept',
});

describe('roles you do', () => {
  it('makes the first role the main one and never adds duplicates', () => {
    let list: PickedRole[] = [];
    list = addRole(list, role(1));
    list = addRole(list, role(2));
    list = addRole(list, role(2));
    expect(list.map((r) => [r.code, r.primary])).toEqual([
      ['HC-0001', true],
      ['HC-0002', false],
    ]);
  });

  it('stops at the maximum so the server limit can never be hit', () => {
    let list: PickedRole[] = [];
    for (let i = 1; i <= MAX_ROLES + 3; i++) list = addRole(list, role(i));
    expect(list).toHaveLength(MAX_ROLES);
  });

  it('hands the main role to the next one when the main role is removed', () => {
    let list = [role(1), role(2), role(3)].reduce(addRole, [] as PickedRole[]);
    list = removeRole(list, 'HC-0001');
    expect(list.map((r) => [r.code, r.primary])).toEqual([
      ['HC-0002', true],
      ['HC-0003', false],
    ]);
    expect(removeRole(list.slice(0, 1), 'HC-0002')).toEqual([]);
  });

  it('keeps exactly one main role and clamps experience', () => {
    let list = [role(1), role(2)].reduce(addRole, [] as PickedRole[]);
    list = makePrimary(list, 'HC-0002');
    expect(list.filter((r) => r.primary).map((r) => r.code)).toEqual(['HC-0002']);
    list = setYears(list, 'HC-0001', -5);
    expect(list[0]!.years).toBe(0);
    list = setYears(list, 'HC-0001', 99);
    expect(list[0]!.years).toBe(60);
    expect(yearsLabel(null)).toBe('Experience not added');
    expect(yearsLabel(0)).toBe('Less than a year');
    expect(yearsLabel(1)).toBe('1 yr');
    expect(yearsLabel(3)).toBe('3 yrs');
  });

  it('serialises to the API body', () => {
    const list = setYears(addRole([], role(7)), 'HC-0007', 3);
    expect(toBody(list)).toEqual({
      roles: [{ role_code: 'HC-0007', years_experience: 3, is_primary: true }],
    });
  });
});
