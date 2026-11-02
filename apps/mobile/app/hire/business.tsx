import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Switch } from 'react-native';
import { api, messageOf, unwrap, unwrapVoid } from '@/api/client';
import {
  useHireAddLocation,
  useHireAddMember,
  useHireBusiness,
  useHireBusinesses,
  useHireLocations,
  useHireMembers,
  useHireQuery,
} from '@/api/hire';
import { exportAccount } from '@/features/account-export';
import { reportSignOut } from '@/features/signout';
import { emailError, passwordError } from '@/features/validation';
import { useAuth } from '@/state/AuthProvider';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  ErrorState,
  Field,
  Row,
  Screen,
  Sheet,
  Text,
} from '@/ui';
import { HireGate, HireHeading, Notice } from '@/ui/hire';

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'] as const;
export default function Business() {
  return (
    <HireGate>
      <BusinessContent />
    </HireGate>
  );
}
function BusinessContent() {
  const router = useRouter();
  const { employerId, role, select } = useHireWorkspace();
  const auth = useAuth();
  const { colors, mode, setMode } = useTheme();
  const business = useHireBusiness();
  const businesses = useHireBusinesses();
  const locations = useHireLocations();
  const members = useHireMembers();
  const addLocation = u¶»§q«^