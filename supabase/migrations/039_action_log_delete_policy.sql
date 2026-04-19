-- Allow users to delete their own action_log entries
CREATE POLICY "action_log_delete_own" ON public.action_log
  FOR DELETE USING (auth.uid() = user_id);
