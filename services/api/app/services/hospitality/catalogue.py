"""Role search over titles and aliases (accent- and punctuation-insensitive)."""

from collections import defaultdict
from collections.abc import Sequence

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.hospitality_schemas import RoleOut
from app.models import (
    HospitalityDepartment,
    HospitalityRole,
    HospitalityRoleAlias,
    RoleVenueCompatibility,
)
from app.services.hospitality.normalize import normalize


def _tokens(q: str) -> list[str]:
    return [t for t in normalize(q).split(" ") if t]


async def search_roles(
    session: AsyncSession,
    q: str | None = None,
    *,
    department: str | None = None,
    venue_type: str | None = None,
    limit: int = 30,
    offset: int = 0,
    codes: Sequence[str] | None = None,
) -> list[RoleOut]:
    stmt = (
        select(HospitalityRole, HospitalityDepartment.name)
        .join(HospitalityDepartment, HospitalityDepartment.code == HospitalityRole.department_code)
        .where(HospitalityRole.status == "active")
    )
    if department:
        stmt = stmt.where(HospitalityRole.department_code == department)
    if venue_type:
        stmt = stmt.where(
            exists().where(
                RoleVenueCompatibility.role_code == HospitalityRole.code,
                RoleVenueCompatibility.venue_code == venue_type,
            )
        )
    if codes is not None:
        stmt = stmt.where(HospitalityRole.code.in_(list(codes)))
    toks = _tokens(q or "")
    for t in toks:
        like = f"%{t}%"
        stmt = stmt.where(
            or_(
                HospitalityRole.title_norm.like(like),
                exists().where(
                    and_(
                        HospitalityRoleAlias.role_code == HospitalityRole.code,
                        HospitalityRoleAlias.alias_norm.like(like),
                    )
                ),
            )
        )
    rows = (await session.execute(stmt)).all()
    if not rows:
        return []
    alias_rows = await session.execute(
        select(
            HospitalityRoleAlias.role_code,
            HospitalityRoleAlias.alias,
            HospitalityRoleAlias.alias_norm,
        ).where(HospitalityRoleAlias.role_code.in_([r.code for r, _ in rows]))
    )
    by_role: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for code, alias, alias_norm in alias_rows:
        by_role[code].append((alias, alias_norm))
    needle = " ".join(toks)

    def rank(role: HospitalityRole) -> tuple[int, int, int]:
        if not needle:
            return (9, role.tier, role.sort_order)
        title = role.title_norm
        if title == needle:
            score = 0
        elif title.startswith(needle):
            score = 1
        elif any(an == needle for _, an in by_role[role.code]):
            score = 2
        elif needle in title:
            score = 3
        elif any(needle in an for _, an in by_role[role.code]):
            score = 4
        else:
            score = 5  # every token matched somewhere, in different places
        return (score, role.tier, role.sort_order)

    ordered = sorted(rows, key=lambda row: rank(row[0]))[offset : offset + limit]
    out = []
    for role, dept_name in ordered:
        matched = None
        if needle and needle not in role.title_norm:
            matched = next((a for a, an in by_role[role.code] if all(t in an for t in toks)), None)
        out.append(
            RoleOut(
                code=role.code,
                title=role.title,
                department_code=role.department_code,
                department_name=dept_name,
                tier=role.tier,
                workstream=role.workstream,
                indicative_text=role.indicative_text,
                indicative_level_min=role.indicative_level_min,
                indicative_level_max=role.indicative_level_max,
                needs_review=role.needs_review,
                duties_based=role.duties_based,
                apprentice=role.apprentice,
                introductory=role.introductory,
                scope_text=role.scope_text,
                compliance_note=role.compliance_note,
                source_url=role.source_url,
                aliases=[a for a, _ in by_role[role.code]],
                matched_alias=matched,
            )
        )
    return out


# Too common in ordinary resume prose to be evidence of a role on their own.
AMBIGUOUS_TERMS = frozenset(
    {"server", "host", "crew", "runner", "cleaner", "baker", "porter", "driver", "staff", "dm"}
)
MAX_SCAN_CHARS = 100_000


async def suggest_from_text(
    session: AsyncSession, text: str, *, limit: int = 8
) -> list[tuple[RoleOut, str, int]]:
    """Proposes roles whose title or alias appears in the text. Proposals only: a person reviews.

    Resume text is untrusted data. It is matched against known role names and nothing in it is
    ever interpreted as an instruction. Returns (role, matched phrase, mentions), best first.
    """
    haystack = f" {normalize(text[:MAX_SCAN_CHARS])} "
    roles = (
        await session.execute(
            select(HospitalityRole.code, HospitalityRole.title, HospitalityRole.title_norm).where(
                HospitalityRole.status == "active"
            )
        )
    ).all()
    aliases = (
        await session.execute(
            select(
                HospitalityRoleAlias.role_code,
                HospitalityRoleAlias.alias,
                HospitalityRoleAlias.alias_norm,
            )
        )
    ).all()
    terms: dict[str, list[tuple[str, str]]] = defaultdict(list)  # role -> [(display, norm)]
    for code, title, title_norm in roles:
        terms[code].append((title, title_norm))
    for code, alias, alias_norm in aliases:
        terms[code].append((alias, alias_norm))
    best: dict[str, tuple[str, int]] = {}
    for code, options in terms.items():
        for display, term in options:
            if len(term) < 4 or term in AMBIGUOUS_TERMS:
                continue
            mentions = haystack.count(f" {term} ")
            if mentions and (code not in best or mentions > best[code][1]):
                best[code] = (display, mentions)
    if not best:
        return []
    details = {r.code: r for r in await search_roles(session, codes=list(best), limit=200)}
    ranked = sorted(best.items(), key=lambda kv: (-kv[1][1], details[kv[0]].tier, kv[0]))
    return [(details[code], phrase, n) for code, (phrase, n) in ranked[:limit] if code in details]
