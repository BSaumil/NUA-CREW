jest.mock('expo-linking', () => ({ createURL: (p: string) => `nuacrew:/${p}` }));

import { jobShareContent } from '../src/features/share';

const job = { id: 'j1', title: 'Barista', suburb: 'Fitzroy', employer: { name: 'Cafe Nua' } };

describe('jobShareContent', () => {
  it('android: the link is inside the message (Android drops a separate url)', () => {
    const c = jobShareContent(job, 'android');
    expect(c.message).toContain('Barista at Cafe Nua (Fitzroy)');
    expect(c.message).toMatch(/job\/j1/);
    expect('url' in c).toBe(false);
  });

  it('ios: the link goes in url so the share sheet shows it as a link', () => {
    const c = jobShareContent(job, 'ios') as { message: string; url: string };
    expect(c.url).toMatch(/job\/j1/);
    expect(c.message).not.toMatch(/job\/j1/);
  });

  it('copes with a missing employer name and suburb', () => {
    const c = jobShareContent({ id: 'j2', title: 'Chef', employer: {} }, 'android');
    expect(c.message).toContain('Chef at an employer — on NUA CREW');
  });
});
