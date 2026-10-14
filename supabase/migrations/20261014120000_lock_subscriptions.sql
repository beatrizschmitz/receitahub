-- Segurança: a assinatura e a cota de chat não podem ser alteradas pelo
-- próprio usuário.
--
-- Antes, as policies abaixo deixavam o usuário autenticado fazer INSERT/UPDATE
-- na PRÓPRIA linha de `subscriptions` — e portanto trocar plan_tier para
-- 'premium' (com current_period_end no futuro) direto do navegador, sem pagar.
-- O mesmo valia para `chat_usage`, o que permitia zerar a cota diária do plano
-- gratuito. Agora:
--   * subscriptions: o usuário só LÊ a sua linha e só consegue CRIAR uma linha
--     'free' (criada na primeira visita). Qualquer outra mudança é feita no
--     servidor, com service role (payForPlan, cancelMySubscription, downgradeToFree).
--   * chat_usage: o usuário só LÊ. O contador é incrementado pela função
--     increment_chat_usage(), que passa a ser SECURITY DEFINER.

-- ---- subscriptions ---------------------------------------------------------
DROP POLICY IF EXISTS "Users update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users create own subscription" ON public.subscriptions;

CREATE POLICY "Users create own free subscription"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND plan_tier = 'free'
    AND status = 'active'
    AND current_period_end IS NULL
    AND payment_provider_id IS NULL
  );

-- ---- chat_usage ------------------------------------------------------------
DROP POLICY IF EXISTS "Users create own chat usage" ON public.chat_usage;
DROP POLICY IF EXISTS "Users update own chat usage" ON public.chat_usage;

CREATE OR REPLACE FUNCTION public.increment_chat_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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
