import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { BrandLockup, Button, SUPPORT_LINE, TAGLINE, Text } from '@/ui';
import { ONBOARDED_KEY } from './index';

const SLIDES = [
  { title: TAGLINE, body: `${SUPPORT_LINE} Find work that fits your skills, life and ambitions.` },
  {
    title: 'Pay you can see',
    body: 'Every job says whether pay is disclosed by the employer, estimated, or not published. No guessing.',
  },
  {
    title: 'Honest matching',
    body: 'See why a job suits you, and what is missing. Match scores are estimates, never a prediction of being hired.',
  },
  {
    title: 'Alerts that fit',
    body: 'Save a search and we will tell you when new jobs match. Turn it off any time.',
  },
] as const;

export default function Welcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const done = async (to: '/login' | '/register') => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => undefined);
    router.replace(to);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  const last = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          padding: space(2.5),
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <BrandLockup />
        <Button title="Skip" variant="ghost" onPress={() => void done('/login')} />
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        accessibilityLabel={`Welcome, page ${index + 1} of ${SLIDES.length}`}
      >
        {SLIDES.map((s) => (
          <View
            key={s.title}
            style={{ width, padding: space(3), justifyContent: 'center', gap: space(2) }}
          >
            <Text variant="display" accessibilityRole="header">
              {s.title}
            </Text>
            <Text variant="body" muted>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, padding: space(2) }}
      >
        {SLIDES.map((s, i) => (
          <View
            key={s.title}
            style={{
              width: i === index ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
      <View style={{ padding: space(2.5), gap: space(1.5) }}>
        {last ? (
          <>
            <Button title="Create free account" full onPress={() => void done('/register')} />
            <Button
              title="I already have an account"
              variant="secondary"
              full
              onPress={() => void done('/login')}
            />
          </>
        ) : (
          <Button
            title="Next"
            full
            onPress={() => ref.current?.scrollTo({ x: (index + 1) * width, animated: true })}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
