import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

type ShareableJob = {
  id: string;
  title: string;
  suburb?: string | null;
  employer: { name?: string | null };
};

/**
 * Text plus a link that opens the job in the app (nuacrew://job/<id>). Android shares only the
 * message, so the link must be in the text; iOS shows the url separately. https links for people
 * without the app need a cleared domain and are not available yet.
 */
export function jobShareContent(j: ShareableJob, platform: string = Platform.OS) {
  const url = Linking.createURL(`/job/${j.id}`);
  const where = j.suburb ? ` (${j.suburb})` : '';
  const text = `${j.title} at ${j.employer.name ?? 'an employer'}${where} — on NUA CREW`;
  return platform === 'ios' ? { message: text, url } : { message: `${text}\n${url}` };
}

export const shareJob = (j: ShareableJob) => Share.share(jobShareContent(j));
