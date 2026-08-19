interface StudentPlaceholderPageProps {
  title: string;
  subtitle: string;
}

export default function StudentPlaceholderPage({ title, subtitle }: StudentPlaceholderPageProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
        {title}
      </h2>
      <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
    </div>
  );
}
