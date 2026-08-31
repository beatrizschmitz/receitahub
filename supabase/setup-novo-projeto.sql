-- ============================================================================
-- ReceitaHub — schema completo para um projeto Supabase NOVO e VAZIO
-- ============================================================================
-- Consolida as 9 migrations do projeto em um único script.
-- Cole inteiro no SQL Editor do novo projeto e execute de uma vez.
-- É idempotente: rodar de novo não quebra nada.
--
-- Não migra dados — o banco novo começa vazio, como combinado.
-- ============================================================================


-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.plan_tier AS ENUM ('free', 'basico', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 2. FUNÇÃO COMPARTILHADA DE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;


-- ============================================================================
-- 3. TABELAS
-- ============================================================================

-- ---- profiles -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- pantry_items ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pantry_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  category     text NOT NULL DEFAULT 'Outros',
  quantity     text,
  expires_in   integer NOT NULL DEFAULT 7,
  purchased_at date,
  expires_at   date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- user_recipes ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_recipes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                text NOT NULL,
  image_url            text,
  category             text,
  time_minutes         integer,
  difficulty           text,
  diet                 text[] DEFAULT ARRAY[]::text[],
  description          text,
  ingredients          text[],
  instructions         text,
  is_favorite          boolean NOT NULL DEFAULT false,
  calories_per_serving integer,
  rating               integer CHECK (rating BETWEEN 1 AND 5),
  notes                text,
  times_cooked         integer NOT NULL DEFAULT 0,
  cost_home_brl        numeric(10,2),
  cost_delivery_brl    numeric(10,2),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---- shopping_list_items --------------------------------------------------
-- Atenção: user_id sem FK para auth.users, exatamente como no banco atual.
-- Ver a observação no relatório sobre linhas órfãs ao apagar um usuário.
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  name         text NOT NULL,
  category     text,
  quantity     text,
  source       text NOT NULL DEFAULT 'manual',
  is_purchased boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- calorie_log ----------------------------------------------------------
-- Idem: user_id sem FK, como no original.
CREATE TABLE IF NOT EXISTS public.calorie_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  recipe_id    uuid REFERENCES public.user_recipes(id) ON DELETE SET NULL,
  recipe_title text NOT NULL,
  calories     integer NOT NULL,
  consumed_at  date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- subscriptions --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier           public.plan_tier NOT NULL DEFAULT 'free',
  status              public.subscription_status NOT NULL DEFAULT 'active',
  started_at          timestamptz NOT NULL DEFAULT now(),
  current_period_end  timestamptz,
  payment_provider_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---- chat_usage -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_count  integer NOT NULL DEFAULT 0,
  reference_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reference_date)
);

-- ---- diet_plans -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text,
  objective      text NOT NULL,
  restrictions   text[] DEFAULT ARRAY[]::text[],
  profile_notes  text,
  generated_plan jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---- photo_recognition_requests -------------------------------------------
CREATE TABLE IF NOT EXISTS public.photo_recognition_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url           text,
  recognized_item     text,
  generated_recipe_id uuid REFERENCES public.user_recipes(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 4. ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id
  ON public.pantry_items(user_id);

CREATE INDEX IF NOT EXISTS idx_user_recipes_user_id
  ON public.user_recipes(user_id);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_user_purchased
  ON public.shopping_list_items(user_id, is_purchased);

CREATE INDEX IF NOT EXISTS idx_calorie_log_user_date
  ON public.calorie_log(user_id, consumed_at DESC);


-- ============================================================================
-- 5. GRANTS
-- ============================================================================
-- O Supabase normalmente concede isso por default privileges, mas deixar
-- explícito torna o script independente da configuração do projeto.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.pantry_items,
  public.user_recipes,
  public.shopping_list_items,
  public.calorie_log,
  public.subscriptions,
  public.chat_usage,
  public.diet_plans,
  public.photo_recognition_requests
TO authenticated;

GRANT ALL ON
  public.profiles,
  public.pantry_items,
  public.user_recipes,
  public.shopping_list_items,
  public.calorie_log,
  public.subscriptions,
  public.chat_usage,
  public.diet_plans,
  public.photo_recognition_requests
TO service_role;


-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recipes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calorie_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_usage                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_recognition_requests ENABLE ROW LEVEL SECURITY;

-- ---- profiles -------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ---- pantry_items ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own pantry items" ON public.pantry_items;
CREATE POLICY "Users can view their own pantry items"
  ON public.pantry_items FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own pantry items" ON public.pantry_items;
CREATE POLICY "Users can create their own pantry items"
  ON public.pantry_items FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own pantry items" ON public.pantry_items;
CREATE POLICY "Users can update their own pantry items"
  ON public.pantry_items FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own pantry items" ON public.pantry_items;
CREATE POLICY "Users can delete their own pantry items"
  ON public.pantry_items FOR DELETE USING (auth.uid() = user_id);

-- ---- user_recipes ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own recipes" ON public.user_recipes;
CREATE POLICY "Users can view their own recipes"
  ON public.user_recipes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own recipes" ON public.user_recipes;
CREATE POLICY "Users can create their own recipes"
  ON public.user_recipes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own recipes" ON public.user_recipes;
CREATE POLICY "Users can update their own recipes"
  ON public.user_recipes FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own recipes" ON public.user_recipes;
CREATE POLICY "Users can delete their own recipes"
  ON public.user_recipes FOR DELETE USING (auth.uid() = user_id);

-- ---- shopping_list_items --------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own shopping items" ON public.shopping_list_items;
CREATE POLICY "Users can view their own shopping items"
  ON public.shopping_list_items FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own shopping items" ON public.shopping_list_items;
CREATE POLICY "Users can create their own shopping items"
  ON public.shopping_list_items FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own shopping items" ON public.shopping_list_items;
CREATE POLICY "Users can update their own shopping items"
  ON public.shopping_list_items FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own shopping items" ON public.shopping_list_items;
CREATE POLICY "Users can delete their own shopping items"
  ON public.shopping_list_items FOR DELETE USING (auth.uid() = user_id);

-- ---- calorie_log ----------------------------------------------------------
-- Sem policy de UPDATE: o log é append-only, como no banco atual.
DROP POLICY IF EXISTS "Users can view their own calorie log" ON public.calorie_log;
CREATE POLICY "Users can view their own calorie log"
  ON public.calorie_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their own calorie log" ON public.calorie_log;
CREATE POLICY "Users can insert into their own calorie log"
  ON public.calorie_log FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their own calorie log" ON public.calorie_log;
CREATE POLICY "Users can delete from their own calorie log"
  ON public.calorie_log FOR DELETE USING (auth.uid() = user_id);

-- ---- subscriptions --------------------------------------------------------
-- Sem policy de DELETE: cancelar é um UPDATE de status, nunca um DELETE.
DROP POLICY IF EXISTS "Users view own subscription" ON public.subscriptions;
CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own subscription" ON public.subscriptions;
CREATE POLICY "Users create own subscription"
  ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own subscription" ON public.subscriptions;
CREATE POLICY "Users update own subscription"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---- chat_usage -----------------------------------------------------------
DROP POLICY IF EXISTS "Users view own chat usage" ON public.chat_usage;
CREATE POLICY "Users view own chat usage"
  ON public.chat_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own chat usage" ON public.chat_usage;
CREATE POLICY "Users create own chat usage"
  ON public.chat_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own chat usage" ON public.chat_usage;
CREATE POLICY "Users update own chat usage"
  ON public.chat_usage FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---- diet_plans -----------------------------------------------------------
DROP POLICY IF EXISTS "Users view own diet plans" ON public.diet_plans;
CREATE POLICY "Users view own diet plans"
  ON public.diet_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own diet plans" ON public.diet_plans;
CREATE POLICY "Users create own diet plans"
  ON public.diet_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own diet plans" ON public.diet_plans;
CREATE POLICY "Users update own diet plans"
  ON public.diet_plans FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own diet plans" ON public.diet_plans;
CREATE POLICY "Users delete own diet plans"
  ON public.diet_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- photo_recognition_requests -------------------------------------------
DROP POLICY IF EXISTS "Users view own photo requests" ON public.photo_recognition_requests;
CREATE POLICY "Users view own photo requests"
  ON public.photo_recognition_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own photo requests" ON public.photo_recognition_requests;
CREATE POLICY "Users create own photo requests"
  ON public.photo_recognition_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Necessária para vincular a receita gerada (generated_recipe_id) depois que
-- o usuário salva a receita vinda da foto.
DROP POLICY IF EXISTS "Users update own photo requests" ON public.photo_recognition_requests;
CREATE POLICY "Users update own photo requests"
  ON public.photo_recognition_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own photo requests" ON public.photo_recognition_requests;
CREATE POLICY "Users delete own photo requests"
  ON public.photo_recognition_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 7. TRIGGERS DE updated_at
-- ============================================================================
-- calorie_log e photo_recognition_requests não têm coluna updated_at.

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pantry_items_updated_at ON public.pantry_items;
CREATE TRIGGER update_pantry_items_updated_at BEFORE UPDATE ON public.pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_recipes_updated_at ON public.user_recipes;
CREATE TRIGGER update_user_recipes_updated_at BEFORE UPDATE ON public.user_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_list_items_updated_at ON public.shopping_list_items;
CREATE TRIGGER update_shopping_list_items_updated_at BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_usage_updated_at ON public.chat_usage;
CREATE TRIGGER update_chat_usage_updated_at BEFORE UPDATE ON public.chat_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_diet_plans_updated_at ON public.diet_plans;
CREATE TRIGGER update_diet_plans_updated_at BEFORE UPDATE ON public.diet_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- 8. NOVO USUÁRIO: cria profile + assinatura gratuita
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.subscriptions (user_id, plan_tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 9. RPC: contador diário de mensagens do chat
-- ============================================================================
-- SECURITY INVOKER de propósito: roda como o usuário chamador, então o RLS
-- de chat_usage continua valendo e ninguém incrementa a cota de outro.

CREATE OR REPLACE FUNCTION public.increment_chat_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.chat_usage (user_id, reference_date, message_count)
  VALUES (auth.uid(), CURRENT_DATE, 1)
  ON CONFLICT (user_id, reference_date)
  DO UPDATE SET message_count = public.chat_usage.message_count + 1,
                updated_at    = now()
  RETURNING message_count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_chat_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_chat_usage() TO authenticated;


-- ============================================================================
-- 10. STORAGE: bucket das fotos enviadas no chat
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pantry-photos',
  'pantry-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Cada usuário só enxerga e grava dentro da própria pasta ({user_id}/arquivo.jpg)
DROP POLICY IF EXISTS "Users upload own pantry photos" ON storage.objects;
CREATE POLICY "Users upload own pantry photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pantry-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users view own pantry photos" ON storage.objects;
CREATE POLICY "Users view own pantry photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pantry-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own pantry photos" ON storage.objects;
CREATE POLICY "Users delete own pantry photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pantry-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 11. BACKFILL
-- ============================================================================
-- No-op num banco vazio. Só serve se você já tiver criado alguma conta de
-- teste antes de rodar este script — garante a assinatura gratuita dela.

INSERT INTO public.subscriptions (user_id, plan_tier, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================================
-- CACHE DE FOTOS DO PEXELS
-- ============================================================================
-- Indexado pelo termo de busca, não pela receita: as receitas geradas não são
-- persistidas, e chavear pelo termo faz duas receitas do mesmo prato reusarem
-- a foto, mantendo o uso dentro do limite gratuito do Pexels.

CREATE TABLE IF NOT EXISTS public.recipe_images (
  query text PRIMARY KEY,
  image_url text,
  photographer text,
  photographer_url text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_images ENABLE ROW LEVEL SECURITY;

-- Crédito do fotógrafo viaja junto da receita salva (image_url já existia).
ALTER TABLE public.user_recipes
  ADD COLUMN IF NOT EXISTS image_photographer text,
  ADD COLUMN IF NOT EXISTS image_photographer_url text;

DROP POLICY IF EXISTS "Anyone reads recipe images" ON public.recipe_images;
CREATE POLICY "Anyone reads recipe images" ON public.recipe_images
  FOR SELECT TO anon, authenticated
  USING (true);


-- ============================================================================
-- FIM
-- ============================================================================
