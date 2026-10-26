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
import { api, unwrap } from '@/api/client';
import { session, type TokenResponse } from '@/api/session';
import { disablePush } from '@/features/push';

const BIOMETRIC_KEY = 'nua.biometric';
const RELOCK_AFTER_MS = 30_000;

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthCtx = {
  status: Status;
  /** True while the biometric lock screen should cover the app. */
  locked: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { fullName: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometric: (on: boolean) => Promise<boolean>;
  /** After account deletion the server session is already gone. */
  clearLocal: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
const deviceLabel = () => (Device.modelName ?? Platform.OS).slice(0, 100);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const leftAt = useRef<number | null>(null);

  useEffect(
    () => session.subscribe((signedIn) => setStatus(signedIn ? 'signedIn' : 'signedOut')),
    [],
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
      const resumed = await session.restore();
      if (resumed && enabled && hw) setLocked(true);
      setStatus(resumed ? 'signedIn' : 'signedOut');
    })().catch(() => setStatus('signedOut'));
  }, []);

  // Re-lock after the app has been in the background for a while.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') leftAt.current ??= Date.now();
      else if (s === 'active') {
        if (biometricEnabled && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS)
          setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [biometricEnabled]);

  const begin = useCallback(async (t: TokenResponse) => {
    await session.start(t);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const t = unwrap(
        await api.POST('/v1/auth/login', {
          body: { email, password, client: 'mobile', device_label: deviceLabel() },
        }),
      );
      if (t.role !== 'candidate') {
        // Never keep an employer session in the job-seeker app: revoke what we were just issued.
        if (t.refresh_token)
          await api
            .POST('/v1/auth/logout', { body: { refresh_token: t.refresh_token } })
            .catch(() => undefined);
        throw new Error('This app is for job seekers. Employers use NUA CREW Hire on the web.');
      }
      qc.clear();
      await begin(t);
    },
    [begin, qc],
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
      qc.clear();
      await begin(t);
    },
    [begin, qc],
  );

  const signOut = useCallback(async () => {
    await disablePush();
    await session.signOut();
    qc.clear();
    await AsyncStorage.multiRemove(['REACT_QUERY_OFFLINE_CACHE', 'nua.filters']);
    setLocked(false);
  }, [qc]);

  const clearLocal = useCallback(async () => {
    await disablePush();
    await session.clear();
    qc.clear();
    await AsyncStorage.multiRemove(['REACT_QUERY_OFFLINE_CACHE', 'nua.filters', BIOMETRIC_KEY]);
    setBiometricEnabled(false);
    setLocked(false);
  }, [qc]);

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
      locked,
      biometricEnabled,
      biometricAvailable,
      signIn,
      register,
      signOut,
      unlock,
      setBiometric,
      clearLocal,
    }),
    [
      status,
      locked,
      biometricEnabled,
      biometricAvailable,
      signIn,
      register,
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
