-- Supabase Realtime requires RLS authorization policies on realtime.messages
-- for Presence and Broadcast; without them, presence_state/presence_diff
-- messages are silently dropped (join and track() calls still ack "ok", but
-- no sync/join/leave event ever reaches any client, including the tracking
-- client itself). This blocked the host's "who's currently connected" panel
-- used to help a dropped student rejoin mid-quiz.
--
-- Both host and players connect as anonymous Supabase auth users (see
-- supabase.auth.signInAnonymously() in the app), so anon/authenticated need
-- read+write access to presence messages. There's no sensitive data in a
-- presence payload (just nickname + a timestamp), so a permissive policy
-- scoped to the 'presence' extension is appropriate here.

create policy "Presence is readable by everyone"
on "realtime"."messages"
for select
to anon, authenticated
using ( realtime.messages.extension = 'presence' );

create policy "Anyone can track their own presence"
on "realtime"."messages"
for insert
to anon, authenticated
with check ( realtime.messages.extension = 'presence' );
