import { createFileRoute, redirect } from "@tanstack/react-router";

// Funcionalidade de lista de compras removida do produto. A rota fica só
// para não quebrar links antigos e manda todo mundo para a despensa, de onde
// a ideia tinha saído.
export const Route = createFileRoute("/lista-compras")({
  beforeLoad: () => {
    throw redirect({ to: "/minha-despensa", replace: true });
  },
});
