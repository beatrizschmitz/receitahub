# Roteiro de teste logado (rodar antes de divulgar)

Use **três contas de teste** (gratuito, básico, premium) e uma janela anônima.
Marque cada item. Se algo falhar, anote a tela e o erro do console (F12).

## 0. Antes de tudo
- [ ] Rodar o SQL `supabase/migrations/20261014120000_lock_subscriptions.sql` no Supabase (SQL Editor) **depois** do deploy do código novo.
- [ ] Conferir que `SUPABASE_SERVICE_ROLE_KEY` está nas variáveis de ambiente do Vercel (as funções de assinatura e a exclusão de conta dependem dela).
- [ ] `npm test` passa e `npm run build` conclui.

## 1. Segurança (conta gratuita, com o console aberto)
- [ ] No console: `supabase.from("subscriptions").update({plan_tier:"premium"})` → **deve falhar** (sem permissão / 0 linhas).
- [ ] No console, tentar criar `subscriptions` com `plan_tier:"premium"` → **deve falhar**.
- [ ] Mandar mensagens no chat até o limite diário: o contador sobe e o bloqueio aparece.
- [ ] Com duas contas diferentes, confirmar que cada uma só vê a própria despensa, receitas, calorias e planos.

## 2. Assinatura e pagamento
- [ ] Gratuito → /pagamento → aprovar com cartão de teste → plano muda para Básico/Premium.
- [ ] Cartão terminado em `0002` é recusado (modo simulado).
- [ ] "Cancelar assinatura" mantém o acesso até o fim do período; depois volta ao gratuito.
- [ ] "Voltar para o gratuito" só funciona sem plano pago vigente.

## 3. Menu Premium (cabeçalho)
- [ ] Gratuito: "Plano alimentar" e "Reconhecimento por foto" levam a /planos.
- [ ] Básico: foto abre o chat e o seletor de imagem; plano alimentar leva a /planos.
- [ ] Premium: os dois funcionam; o botão aparece como "Recursos".

## 4. Plano alimentar (premium)
- [ ] Formulário: sexo, idade, peso, altura, atividade → painel de metas aparece ao vivo.
- [ ] Idade < 18 é recusada; marcar gestante nunca gera déficit.
- [ ] Gerar plano: 7 dias, 5 refeições/dia, quantidades por alimento, totais do dia próximos da meta.
- [ ] Planos antigos (sem metas) ainda abrem.
- [ ] Renomear e apagar plano.

## 5. Despensa
- [ ] Digitar "tomates", "cuscuz", "Nutella", "shimeji": categoria aparece na hora.
- [ ] Digitar um item estranho (ex.: "pó de guaraná"): vira "Outros" e depois a IA sugere ("identificando…").
- [ ] Escolher a categoria à mão: a IA não sobrescreve.

## 6. Minhas receitas
- [ ] "+ Comi isso" mostra "Registrado!" e o aviso com **Desfazer** (8 s).
- [ ] "Desfazer" (aviso, cartão e detalhe) remove as calorias de hoje e desce o contador "feita N×".
- [ ] "Já preparadas" e "refeição registrada" batem depois do desfazer.

## 7. Conta
- [ ] Perfil → Apagar dados: despensa, receitas e calorias zeram.
- [ ] Perfil → Excluir conta (digitar EXCLUIR): não consegue mais entrar.

## 8. Visual
- [ ] Tema claro e escuro nas páginas principais; textos legíveis.
- [ ] Celular (375 px): sem rolagem horizontal; menu Premium utilizável.
- [ ] Rodapé com links de Privacidade e Termos em todas as páginas.
