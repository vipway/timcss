export function App() {
  return (
    <main className="px-page py-section bg-background">
      <section className="gap-section" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="text-primary">
          <h1>TimCSS React Mobile</h1>
          <p className="text-muted">Atomic mobile utilities built on the Tailwind compiler.</p>
        </header>

        <article className="bg-surface p-card rounded-card shadow-card">
          <div className="gap-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <strong className="text-primary">Layout intent</strong>
            <span className="text-muted">
              Prefer page, section and card atomic utilities over one-off spacing values.
            </span>
          </div>
        </article>

        <article className="bg-surface p-card rounded-card shadow-card">
          <div className="gap-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <strong className="text-primary">Interactive controls</strong>
            <button className="h-control min-h-touch rounded-control bg-primary text-on-primary pressed:opacity-80">
              Primary action
            </button>
            <button className="h-control-sm min-h-touch rounded-control bg-surface text-primary border border-default disabled:bg-surface">
              Secondary action
            </button>
          </div>
        </article>
      </section>
    </main>
  )
}
