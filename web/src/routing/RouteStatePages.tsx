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

export function PlannedPage({
  title,
  release,
}: {
  title: string;
  release?: string;
}) {
  return (
    <section className="route-state" aria-labelledby="planned-title">
      <p className="eyebrow">Planned capability</p>
      <h1 id="planned-title">{title}</h1>
      <p className="muted">
        {release === undefined
          ? "This approved route is reserved for a later implementation phase."
          : `${release} owns this feature. Its data pipeline is not implemented in Release 0.4.1.`}
      </p>
      <p>
        This page is intentionally explicit so a bookmark or typed address
        cannot be mistaken for the Dashboard.
      </p>
      <a className="button button--secondary" href="/">
        Return to Dashboard
      </a>
    </section>
  );
}
