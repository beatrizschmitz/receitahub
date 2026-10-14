export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-cream/50">
          <div className="font-display italic text-blush text-lg font-mono">receitahub</div>
          <div>© {new Date().getFullYear()} receitahub. cozinhe com inteligência.</div>
        </div>
        <p className="text-xs text-cream/35 leading-relaxed">
          Projeto Integrador III — Centro Universitário de Brasília (CEUB) · Orientação: Prof. Lucas Rodrigues da Silva · Equipe: Beatriz Schmitz, Gabrielle Gonçalves Gutierres, Luísa de Moura Zimmer
        </p>
      </div>
    </footer>
  );
}
