import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

export const ONBOARDED_KEY = 'nua.onboarded';

/** First launch shows the welcome carousel; afterwards we go straight to sign-in. */
export default function AuthIndex() {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(true));
  }, []);
  if (seen === null) return null;
  return <Redirect href={seen ? '/login' : '/welcome'} />;
}
