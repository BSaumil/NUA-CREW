import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { addMyRole, removeMyRole, saveMyRoles } from '../../actions';
import { Flash, flashFrom } from '../../components';

export const metadata: Metadata = { title: 'Roles you do' };

export default async function MyRoles({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { error, notice, p } = await flashFrom(searchParams);
  const one = (k: string) => {
    const v = p[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };
  const q = one('q');
  const dept = one('dept');
  const client = await api();
  const [{ data: mine }, { data: departments }, { data: found }] = await Promise.all([
    client.GET('/v1/candidate/roles'),
    client.GET('/v1/taxonomy/departments'),
    client.GET('/v1/taxonomy/roles', { params: { query: { q, department: dept, limit: 12 } } }),
  ]);
  const have = new Set((mine ?? []).map((r) => r.role.code));
  const addable = (found ?? []).filter((r) => !have.has(r.code));
  return (
    <div className="nua-stack" style={{ maxWidth: 760 }}>
      <h1>Roles you do</h1>
      <p className="nua-hint">
        Pick up to 8. These are private to you and improve your job matches. Employers only see what
        you share when you apply.
      </p>
      <Flash error={error} notice={notice} />
      {(mine ?? []).length === 0 ? (
        <p className="nua-card">No roles yet. Search below, for example “waiter” or “barista”.</p>
      ) : (
        <form action={saveMyRoles} className="nua-card nua-stack" aria-labelledby="mine-h">
          <h2 id="mine-h">Your roles</h2>
          <ul className="nua-rolelist">
            {(mine ?? []).map((r) => (
              <li key={r.role.code} className="nua-role" style={{ flexWrap: 'wrap' }}>
                <input type="hidden" name="role_code" value={r.role.code} />
                <span>
                  <span className="nua-role__title">{r.role.title}</span>
                  <span className="nua-hint" style={{ display: 'block' }}>
                    {r.role.department_name}
                  </span>
                </span>
                <span className="nua-row">
                  <span className="nua-field" style={{ width: 130 }}>
                    <label htmlFor={`years_${r.role.code}`}>Years</label>
                    <input
                      id={`years_${r.role.code}`}
                      name={`years_${r.role.code}`}
                      type="number"
                      min={0}
                      max={60}
                      defaultValue={r.years_experience ?? ''}
                    />
                  </span>
                  <span className="nua-row">
                    <input
                      id={`primary_${r.role.code}`}
                      type="radio"
                      name="primary"
                      value={r.role.code}
                      defaultChecked={r.is_primary}
                    />
                    <label htmlFor={`primary_${r.role.code}`}>Main role</label>
                  </span>
                  <button
                    type="submit"
                    formAction={removeMyRole.bind(null, r.role.code)}
                    className="nua-button nua-button--secondary"
                    aria-label={`Remove ${r.role.title}`}
                    formNoValidate
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Button type="submit">Save my roles</Button>
          </div>
        </form>
      )}
      <section className="nua-stack" aria-labelledby="add-h">
        <h2 id="add-h">Add a role</h2>
        <form method="get" action="/profile/roles" className="nua-row" role="search">
          {dept ? <input type="hidden" name="dept" value={dept} /> : null}
          <div className="nua-field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="q">Search roles</label>
            <input id="q" name="q" defaultValue={q ?? ''} placeholder="e.g. waitstaff, CDP" />
          </div>
          <Button type="submit">Search</Button>
        </form>
        <details open={Boolean(dept)}>
          <summary>Filter by department</summary>
          <ul className="nua-chips">
            <li>
              <Link
                className="nua-chip"
                aria-current={!dept}
                href={`/profile/roles${q ? `?q=${encodeURIComponent(q)}` : ''}`}
              >
                All
              </Link>
            </li>
            {(departments ?? []).map((d) => (
              <li key={d.code}>
                <Link
                  className="nua-chip"
                  aria-current={dept === d.code}
                  href={`/profile/roles?dept=${d.code}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                >
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        {addable.length === 0 ? (
          <p>No roles match. Try a shorter search.</p>
        ) : (
          <ul className="nua-rolelist">
            {addable.map((r) => (
              <li key={r.code} className="nua-role">
                <span>
                  <span className="nua-role__title">{r.title}</span>
                  <span className="nua-hint" style={{ display: 'block' }}>
                    {r.department_name}
                    {r.matched_alias ? ` · also called “${r.matched_alias}”` : ''}
                  </span>
                </span>
                <form action={addMyRole}>
                  <input type="hidden" name="role_code" value={r.code} />
                  <Button type="submit" variant="secondary" aria-label={`Add ${r.title}`}>
                    Add
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
