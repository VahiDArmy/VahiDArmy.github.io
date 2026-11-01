-- اجازهٔ نوشتن active/wins/losses برای کلاینت anon (بدون لاگین)
-- فقط اگر سیاست فعلی authenticated باعث می‌شود active ذخیره نشود.

DROP POLICY IF EXISTS "Authenticated can manage AI models" ON public.cinema_ai_models;
CREATE POLICY "Anyone can manage AI models"
  ON public.cinema_ai_models
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage deleted models" ON public.cinema_ai_models_deleted;
CREATE POLICY "Anyone can manage deleted models"
  ON public.cinema_ai_models_deleted
  FOR ALL
  USING (true)
  WITH CHECK (true);
