CREATE POLICY mission_log_delete ON mission_log
  FOR DELETE USING (auth.uid() = user_id);
