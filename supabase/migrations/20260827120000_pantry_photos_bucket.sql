-- Bucket privado para as fotos enviadas no chat do Chef Despensa
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

-- A tabela nasceu sem policy de UPDATE, então vincular a receita gerada
-- (generated_recipe_id) era barrado pelo RLS sem devolver erro.
DROP POLICY IF EXISTS "Users update own photo requests" ON public.photo_recognition_requests;
CREATE POLICY "Users update own photo requests" ON public.photo_recognition_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
