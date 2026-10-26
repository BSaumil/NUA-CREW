import { Redirect } from 'expo-router';

/** Entering the signed-in area lands on Discover. */
export default function Index() {
  return <Redirect href="/(app)/discover" />;
}
