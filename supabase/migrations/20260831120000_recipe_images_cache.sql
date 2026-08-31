-- Cache de fotos do Pexels, indexado pelo termo de busca (não pela receita).
-- As receitas geradas em /receitas e nos destaques da home não são persistidas,
-- então guardar a URL "junto da receita" não daria reaproveitamento nenhum.
-- Chaveando pelo termo, duas receitas com o mesmo prato reusam a mesma foto e
-- o plano gratuito do Pexels (200 req/hora) não estoura.
CREATE TABLE IF NOT EXISTS public.recipe_images (
  query text PRIMARY KEY,
  -- NULL = já buscamos e o Pexels não devolveu nada. Guardar o negativo evita
  -- repetir a mesma busca infrutífera a cada geração.
  image_url text,
  photographer text,
  photographer_url text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_images ENABLE ROW LEVEL SECURITY;

-- Leitura pública: os destaques da landing aparecem para visitante deslogado.
DROP POLICY IF EXISTS "Anyone reads recipe images" ON public.recipe_images;
CREATE POLICY "Anyone reads recipe images" ON public.recipe_images
  FOR SELECT TO anon, authenticated
  USING (true);

-- Escrita fica só para a service role, usada pelas edge functions. Sem policy
-- de INSERT/UPDATE, o RLS já barra anon e authenticated.

-- A receita salva precisa carregar o crédito do fotógrafo junto, senão o modal
-- de detalhes exibe a foto sem a atribuição que o Pexels exige.
-- (image_url já existia na tabela.)
ALTER TABLE public.user_recipes
  ADD COLUMN IF NOT EXISTS image_photographer text,
  ADD COLUMN IF NOT EXISTS image_photographer_url text;
