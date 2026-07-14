-- participants has no UPDATE policy yet, so without this the heartbeat
-- write from the player page (see participants_last_seen migration) is
-- silently rejected by RLS.
create policy "Participants can update their own last_seen"
  on public.participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
