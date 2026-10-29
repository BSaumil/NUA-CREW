import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { messageOf } from '@/api/client';
import {
  useDepartments,
  useMyRoles,
  useResumeSuggestions,
  useRoleSearch,
  useSaveMyRoles,
} from '@/api/roles';
import {
  MAX_ROLES,
  addRole,
  makePrimary,
  removeRole,
  setYears,
  yearsLabel,
  type PickedRole,
} from '@/features/roles';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  ListSkeleton,
  Row,
  Screen,
  Text,
} from '@/ui';

export default function MyRoles() {
  const { colors } = useTheme();
  const mine = useMyRoles();
  const departments = useDepartments();
  const save = useSaveMyRoles();
  const [picked, setPicked] = useState<PickedRole[]>([]);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const results = useRoleSearch(q, dept);
  const suggestions = useResumeSuggestions();
  const seeded = useRef(false);

  // Seed once from the server so later refetches never overwrite what the person is editing.
  useEffect(() => {
    if (!mine.data || seeded.current) return;
    seeded.current = true;
    setPicked(
      mine.data.map((r) => ({
        code: r.role.code,
        title: r.role.title,
        department: r.role.department_name,
        years: r.years_experience ?? null,
        primary: r.is_primary,
      })),
    );
  }, [mine.data]);

  if (mine.isPending)
    return (
      <Screen>
        <ListSkeleton count={2} />
      </Screen>
    );
  if (mine.isError)
    return (
      <Screen>
        <ErrorState message={messageOf(mine.error)} onRetry={() => void mine.refetch()} />
      </Screen>
    );

  const edit = (fn: (l: PickedRole[]) => PickedRole[]) => {
    setMessage(null);
    setPicked(fn);
  };
  const submit = async () => {
    setMessage(null);
    try {
      await save.mutateAsync(picked);
      setMessage({ ok: true, text: 'Saved. Your job matches now use these roles.' });
    } catch (e) {
      setMessage({ ok: false, text: `${messageOf(e)} Your roles are still here: try again.` });
    }
  };
  const addable = (results.data ?? []).filter((r) => !picked.some((p) => p.code === r.code));

  return (
    <Screen edges={['left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        Roles you do
      </Text>
      <Text muted>
        Pick up to {MAX_ROLES}. Private to you: employers only see what you share when you apply.
      </Text>

      {picked.length === 0 ? (
        <Card>
          <Text muted>No roles yet. Search below, for example “waiter”, “barista” or “CDP”.</Text>
        </Card>
      ) : (
        picked.map((r) => (
          <Card key={r.code}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{r.title}</Text>
                <Text variant="caption" muted>
                  {r.department}
                </Text>
              </View>
              {r.primary ? <Badge tone="ok" icon="★" label="Main role" /> : null}
            </Row>
            <Row>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Fewer years of experience as ${r.title}`}
                onPress={() => edit((l) => setYears(l, r.code, -1))}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="heading">−</Text>
              </Pressable>
              <Text accessibilityLiveRegion="polite">{yearsLabel(r.years)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More years of experience as ${r.title}`}
                onPress={() => edit((l) => setYears(l, r.code, 1))}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="heading">+</Text>
              </Pressable>
            </Row>
            <Row>
              {!r.primary ? (
                <Button
                  title="Make main role"
                  variant="secondary"
                  onPress={() => edit((l) => makePrimary(l, r.code))}
                />
              ) : null}
              <Button
                title="Remove"
                variant="ghost"
                onPress={() => edit((l) => removeRole(l, r.code))}
                accessibilityLabel={`Remove ${r.title}`}
              />
            </Row>
          </Card>
        ))
      )}

      {picked.length < MAX_ROLES ? (
        <View style={{ gap: space(1.5) }}>
          <Button
            title="Find roles in my resume"
            variant="secondary"
            loading={suggestions.isFetching}
            onPress={() => void suggestions.refetch()}
            accessibilityHint="Looks for role names in your own resume. Nothing is added until you choose."
          />
          {suggestions.isSuccess && suggestions.data.length === 0 ? (
            <Text muted>No role names found. Add a resume in Profile, or search below.</Text>
          ) : null}
          {suggestions.isError ? (
            <Text color={colors.danger} accessibilityRole="alert">
              {messageOf(suggestions.error)}
            </Text>
          ) : null}
          {(suggestions.data ?? [])
            .filter((s) => !picked.some((p) => p.code === s.role.code))
            .map((s) => (
              <Pressable
                key={s.role.code}
                accessibilityRole="button"
                accessibilityLabel={`Add ${s.role.title}, found in your resume`}
                onPress={() => edit((l) => addRole(l, s.role))}
                style={{
                  minHeight: 56,
                  paddingHorizontal: space(2),
                  paddingVertical: space(1.25),
                  borderRadius: radius.button,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  backgroundColor: colors.surface,
                  justifyContent: 'center',
                }}
              >
                <Text variant="label">{s.role.title}</Text>
                <Text variant="caption" muted>
                  Found “{s.matched_text}” {s.mentions}× in your resume · {s.role.department_name}
                </Text>
              </Pressable>
            ))}
          <Text variant="heading" accessibilityRole="header">
            Add a role
          </Text>
          <Field
            label="Search roles"
            value={q}
            onChangeText={setQ}
            placeholder="e.g. waitstaff, bartender, kitchen hand"
            autoCorrect={false}
            returnKeyType="search"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Row style={{ flexWrap: 'nowrap' }}>
              <Chip label="All" selected={dept === null} onPress={() => setDept(null)} />
              {(departments.data ?? []).map((d) => (
                <Chip
                  key={d.code}
                  label={d.name}
                  selected={dept === d.code}
                  onPress={() => setDept(dept === d.code ? null : d.code)}
                />
              ))}
            </Row>
          </ScrollView>
          {results.isPending ? <ListSkeleton count={2} /> : null}
          {results.isError ? (
            <ErrorState message={messageOf(results.error)} onRetry={() => void results.refetch()} />
          ) : null}
          {results.isSuccess && addable.length === 0 ? (
            <Text muted>No roles match. Try a shorter search.</Text>
          ) : null}
          {addable.map((r) => (
            <Pressable
              key={r.code}
              accessibilityRole="button"
              accessibilityLabel={`Add ${r.title}, ${r.department_name}`}
              onPress={() => edit((l) => addRole(l, r))}
              style={{
                minHeight: 56,
                paddingHorizontal: space(2),
                paddingVertical: space(1.25),
                borderRadius: radius.button,
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                justifyContent: 'center',
              }}
            >
              <Text variant="label">{r.title}</Text>
              <Text variant="caption" muted>
                {r.department_name}
                {r.matched_alias ? ` · also called “${r.matched_alias}”` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text muted>You&apos;ve added {MAX_ROLES} roles. Remove one to add another.</Text>
      )}

      {message ? (
        <Text
          accessibilityRole={message.ok ? undefined : 'alert'}
          accessibilityLiveRegion="polite"
          color={message.ok ? colors.onSuccessTint : colors.danger}
        >
          {message.text}
        </Text>
      ) : null}
      <Button title="Save my roles" loading={save.isPending} onPress={() => void submit()} />
    </Screen>
  );
}
