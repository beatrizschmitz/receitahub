-- Informação nutricional por porção (calorias, proteína, carboidrato e gordura)
-- guardada junto da receita salva. Formato: {"calories":480,"protein":12,"carbs":70,"fat":17}
-- Nulo nas receitas antigas; a tela calcula e preenche sozinha na primeira abertura.
ALTER TABLE public.user_recipes
  ADD COLUMN IF NOT EXISTS nutrition jsonb;

COMMENT ON COLUMN public.user_recipes.nutrition IS
  'Por porção: {"calories":kcal,"protein":g,"carbs":g,"fat":g}. Estimativa (IA ou tabela de composição).';
