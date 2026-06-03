type InfoPageProps = {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
};

export function InfoPage({ eyebrow, title, children }: InfoPageProps) {
  return (
    <main className="info-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="info-body">{children}</div>
    </main>
  );
}
