import type { Schemas } from '@nua-crew/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import { api, unwrap, UserMessage } from '@/api/client';
import { session, type TokenResponse } from '@/api/session';
import { disablePush } from '@/features/push';
import { CredentialStorageError } from '@/lib/storage';

const BIOMETRIC_KEY = 'nua.biometric';
const RELOCK_AFTER_MS = 30_000;
// Local keys that can hold something about the previous person. Wiped on every sign-out.
const PERSONAL_LOCAL_KEYS = ['REACT_QUERY_OFFLINE_CACHE', 'nua.filters'];

type Status = 'loading' | 'signedOut' | 'signedIn';

export type SignOutResult = {
  /** False if the OS refused to delete the stored credential. The person IS signed out. */
  credentialsRemoved: boolean;
};

type AuthCtx = {
  status: Status;
  role: 'candidate' | 'employer' | null;
  /** True while the biometric lock screen should cover the app. */
  locked: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { fullName: string; email: string; password: string }) => Promise<void>;
  registerEmployer: (input: Schemas['EmployerRegister']) => Promise<void>;
  signOut: () => Promise<SignOutResult>;
  unlock: () => Promise<boolean>;
  setBiometric: (on: boolean) => Promise<boolean>;
  /** After account deletion the server session is already gone. */
  clearLocal: () => Promise<SignOutResult>;
};

const Ctx = createContext<AuthCtx | null>(null);
const deviceLabel = () => (Device.modelName ?? Platform.OS).slice(0, 100);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [role, setRole] = useState<'candidate' | 'employer' | null>(null);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const leftAt = useRef<number | null>(null);

  // One place reacts to every session change, whatever caused it (sign-out button, account
  // deletion, a refresh the server rejected, a revoked device). Signing out ALWAYS drops the
  // previous person's cached data and lock state; no code path can forget to.
  useEffect(
    () =>
      session.subscribe((signedIn) => {
        setRole(signedIn ? session.role : null);
        setStatus(signedIn ? 'signedIn' : 'signedOut');
        if (!signedIn) {
          qc.clear();
          setLocked(false);
          AsyncStorage.multiRemove(PERSONAL_LOCAL_KEYS).catch(() => undefined);
        }
      }),
    [qc],
  );

  useEffect(() => {
    (async () => {
      const enabled = (await AsyncStorage.getItem(BIOMETRIC_KEY)) === '1';
      const hw =
        Platform.OS !== 'web' &&
        (await LocalAuthentication.hasHardwareAsync()) &&
        (await LocalAuthentication.isEnrolledAsync());
      setBiometricAvailable(hw);
      setBiometricEnabled(enabled && hw);
      // Arm the lock BEFORE restoring: restore publishes "signed in", and the app must never be
      // visible for even one frame between that and the lock appearing.
      if (enabled && hw) setLocked(true);
      const resumed = await session.restore();
      if (!resumed) {
        setLocked(false);
        setStatus('signedOut');
      }
    })().catch(() => {
      setLocked(false);
      setStatus('signedOut');
    });
  }, []);

  // Re-lock after the app has been in the background for a while.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') leftAt.current ??= Date.now();
      else if (s === 'active') {
        if (biometricEnabled && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) {
          setLocked(true);
        }
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [biometricEnabled]);

  const begin = useCallback(
    async (t: TokenResponse, revision: number) => {
      if (revision !== session.generation())
        throw new UserMessage('Your session changed. Please try again.');
      qc.clear();
      if (!(await session.start(t, revision)))
        throw new UserMessage('Your session changed. Please try again.');
    },
    [qc],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const revision = session.generation();
      const t = unwrap(
        await api.POST('/v1/auth/login', {
          body: { email, password, client: 'mobile', device_label: deviceLabel() },
        }),
      );
      if (t.role !== 'candidate' && t.role !== 'employer') {
        // Operator sessions belong in the web workspace; revoke the refresh token just issued.
        if (t.refresh_token) {
          await api
            .POST('/v1/auth/logout', { body: { refresh_token: t.refresh_token } })
            .catch(() => undefined);
        }
        throw new UserMessage('Operator accounts use the support workspace on the web.');
      }
      await begin(t, revision);
    },
    [begin],
  );

  const register = useCallback(
    async ({
      fullName,
      email,
      password,
    }: {
      fullName: string;
      email: string;
      password: string;
    }) => {
      const revision = session.generation();
      const t = unwrap(
        await api.POST('/v1/auth/register/candidate', {
          body: {
            email,
            password,
            full_name: fullName,
            accept_terms: true,
            client: 'mobile',
            device_label: deviceLabel(),
          },
        }),
      );
      await begin(t, revision);
    },
    [begin],
  );

  const registerEmployer = useCallback(
    async (input: Schemas['EmployerRegister']) => {
      const revision = session.generation();
      const t = unwrap(
        await api.POST('/v1/auth/register/employer', {
          body: { ...input, client: 'mobile', device_label: deviceLabel() },
        }),
      );
      await begin(t, revision);
    },
    [begin],
  );

  const endSession = useCallback(async (serverSide: boolean): Promise<SignOutResult> => {
    await disablePush().catch(() => undefined); // optional cleanup must never prevent sign-out
    try {
      if (serverSide) await session.signOut();
      else await session.clear();
      return { credentialsRemoved: true };
    } catch (e) {
      // The in-memory session is already gone and caches are cleared by the subscriber above.
      // Only the Keychain/Keystore delete failed; say so rather than pretend.
      if (e instanceof CredentialStorageError) return { credentialsRemoved: false };
      throw e;
    }
  }, []);

  const signOut = useCallback(() => endSession(true), [endSession]);

  const clearLocal = useCallback(async () => {
    await AsyncStorage.removeItem(BIOMETRIC_KEY).catch(() => undefined);
    setBiometricEnabled(false);
    return endSession(false);
  }, [endSession]);

  const unlock = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock NUA CREW',
      fallbackLabel: 'Use passcode',
    });
    if (r.success) setLocked(false);
    return r.success;
  }, []);

  const setBiometric = useCallback(async (on: boolean) => {
    if (on) {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to turn on app lock',
      });
      if (!r.success) return false;
    }
    await AsyncStorage.setItem(BIOMETRIC_KEY, on ? '1' : '0');
    setBiometricEnabled(on);
    return true;
  }, []);

  const value = useMemo(
    () => ({
      status,
      role,
      locked,
      biometricEnabled,
      biometricAvailable,
      signIn,
      register,
      registerEmployer,
      signOut,
      unlock,
      setBiometric,
      clearLocal,
    }),
    [
      status,
      role,
      locked,
      biometricEnabled,
      biometricAvailable,
      signIn,
      register,
      registerEmployer,
      signOut,
      unlock,
      setBiometric,
      clearLocal,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
