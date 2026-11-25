import { ButtonLink, PageHeader, Section } from '../components/ui.tsx';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" intro="The page you’re looking for doesn’t exist or has moved." />
      <Section>
        <ButtonLink to="/">Go to the home page</ButtonLink>
      </Section>
    </>
  );
}
