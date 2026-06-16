type SecuritySectionCopy = {
  title: string;
  body: string;
};

export function TrustSummary({ copy }: { copy: SecuritySectionCopy }) {
  return (
    <section>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
    </section>
  );
}
