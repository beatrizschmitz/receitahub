import { createFileRoute, redirect } from "@tanstack/react-router";

// O reconhecimento por foto passou a viver dentro do chat do Chef Despensa,
// que já enxerga a despensa do usuário. A rota fica apenas para não quebrar
// links antigos e manda todo mundo para a home, onde o chat está disponível.
export const Route = createFileRoute("/foto")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
