import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

/** Reserve room for icons, scaled labels and the system home indicator. */
export function useTabBarStyle() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  return {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 64 + bottom + Math.max(0, fontScale - 1) * 24,
    paddingTop: 6,
    paddingBottom: Math.max(8, bottom),
  };
}
