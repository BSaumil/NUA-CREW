import { PageHero, PrimaryLink, Section } from './components';

export default function NotFound() {
  return (
    <>
      <PageHero
        eyebrow="404"
        title="We could not find that page."
        lede="It may have moved, or the address may be mistyped."
      />
      <Section>
        <PrimaryLink href="/">Back to the home page</PrimaryLink>
      </Section>
    </>
  );
}
