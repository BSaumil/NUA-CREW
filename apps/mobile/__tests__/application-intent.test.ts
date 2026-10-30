import { ApplicationIntent } from '../src/features/application-intent';

it('reuses the submission key on an unchanged retry, even after another payload was edited', () => {
  const intent = new ApplicationIntent();
  const first = intent.forPayload('job', 'resume', 'My note');
  expect(intent.forPayload('job', 'resume', ' My note ')).toBe(first);
  expect(intent.forPayload('job', null, 'My note')).not.toBe(first);
  expect(intent.forPayload('other-job', 'resume', 'My note')).not.toBe(first);
  expect(intent.forPayload('job', 'resume', 'Changed note')).not.toBe(first);
  expect(intent.forPayload('job', 'resume', 'My note')).toBe(first);
  expect(new ApplicationIntent().forPayload('job', 'resume', 'My note')).not.toBe(first);
});
