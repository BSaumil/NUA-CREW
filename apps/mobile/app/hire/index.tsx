import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { canRecruit, useHireBusiness, useHireJobs, useHireLocations } from '@/api/hire';
import { messageOf } from '@/api/client';
import { payRange } from '@/features/format';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Button, Card, Chip, EmptyState, ErrorState, ListSkeleton, Row, Screen, Text } from '@/ui';
import { ActionTile, HireGate, HireHeading, HiringStatus, Notice } from '@/ui/hire';

export default function HireHome() {
  return (
    <HireGate>
      <Jobs />
    </HireGate>
  );
}
function Jobs() {
  const router = useRouter();
  const { colors } = useTheme();
  const { role } = useHireWorkspace();
  const business = useHireBusiness();
  const jobs = useHireJobs();
  const locations = useHireLocations();
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'closed'>('all');
  const items = jobs.data ?? [];
  const liveCount = items.filter((j) => j.status === 'published').length;
  const shown =
    filter === 'all'
      ? items
      : items.filter((j) =>
          filter === 'closed'
            ? ['closed', 'expired', 'unpublished'].includes(j.status)
            : j.status === filter,
        );
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={jobs.isRefetching}
          onRefresh={() => {
            void jobs.refetch();
            void business.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <HireHeading
        title="Build your next team."
        body={business.data?.name ?? 'Your hiring workspace'}
      />
      <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
        <Text variant="caption" color={colors.onPrimary}>
          YOUR HIRING AT A GLANCE
        </Text>
        <Text variant="display" color={colors.onPrimary}>
          {jobs.isPending || jobs.isError ? '—' : liveCount}{' '}
          {liveCount === 1 ? 'live job' : 'live jobs'}
        </Text>
        <Text color={colors.onPrimary}>
          {jobs.isPending || jobs.isError
            ? 'Your job summary will appear here.'
            : `${items.filter((j) => j.status === 'draft').length} drafts ready for your next step`}
        </Text>
      </Card>
      <Row style={{ alignItems: 'stretch' }}>
        {canRecruit(role) ? (
          <ActionTile
            icon={locations.data?.length === 0 ? 'location-outline' : 'add-circle-outline'}
            title={locations.data?.length === 0 ? 'Add a work location' : 'Post a job'}
            detail={
              locations.data?.length === 0
                ? 'Set up your venue before your first role.'
                : 'Clear pay. The right details.'
            }
            onPress={() =>
              router.push(locations.data?.length === 0 ? '/hire/business' : '/hire-post')
            }
          />
        ) : null}
        <ActionTile
          icon="people-outline"
          title="Find people"
          detail="Invite people who chose to be found."
          onPress={() => router.push('/hire/talent')}
        />
      </Row>
      {business.data && business.data.verification_status !== 'verified' ? (
        <Notice
          title="Your business needs verification"
          body="You can save drafts now. Publishing and invitations become available after your business and authorised representative are reviewed."
        />
      ) : null}
      <Text variant="heading" accessibilityRole="header">
        Your jobs
      </Text>
      <Button
        title="Shifts and timesheets"
        variant="secondary"
        onPress={() => router.push('/hire-shifts')}
      />
      <Row>
        {(['all', 'published', 'draft', 'closed'] as const).map((v) => (
          <Chip
            key={v}
            label={{ all: 'All', published: 'Live', draft: 'Drafts', closed: 'Inactive' }[v]}
            selected={filter === v}
            onPress={() => setFilter(v)}
          />
        ))}
      </Row>
      {jobs.isPending ? (
        <ListSkeleton count={2} />
      ) : jobs.isError ? (
        <ErrorState message={messageOf(jobs.error)} onRetry={() => void jobs.refetch()} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={items.length ? 'No jobs in this view' : 'Your next hire starts here'}
          body="Create a draft with the role, location and pay. Review everything before publishing."
        />
      ) : (
        shown.map((job) => (
          <Card key={job.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <HiringStatus status={job.status} />
              <Text variant="caption" muted>
                {job.suburb ?? 'Location needed'}
              </Text>
            </Row>
            <Text variant="heading">{job.title}</Text>
            <Text muted>{payRange(job) ?? 'Pay needs to be added'}</Text>
            <Button
              title={`Manage ${job.title}`}
              variant="secondary"
              onPress={() => router.push({ pathname: '/hire-job/[id]', params: { id: job.id } })}
            />
          </Card>
        ))
      )}
      <View style={{ paddingTop: space(1) }}>
        <Text variant="caption" muted>
          Employees join and apply free. Hiring decisions are always yours.
        </Text>
      </View>
    </Screen>
  );
}
