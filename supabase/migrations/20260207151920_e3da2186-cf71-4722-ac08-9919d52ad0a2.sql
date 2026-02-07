CREATE POLICY "Users can delete own generations"
ON public.ai_generations
FOR DELETE
USING (auth.uid() = user_id);