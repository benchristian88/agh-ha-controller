import { PageContainer, PageHeader } from "../components/Page";

export function NotFoundPage({ pathname }: { pathname: string }) {
  return (
    <PageContainer size="narrow" className="route-state">
      <PageHeader
        eyebrow="404 · Not Found"
        title="This page does not exist"
        titleId="not-found-title"
        focusOnMount
      />
      <p className="muted">
        <code>{pathname}</code> is not a recognised controller route. Check the
        address or return to the cluster dashboard.
      </p>
      <a className="button" href="/">
        Return to Dashboard
      </a>
    </PageContainer>
  );
}
