-- Presence via Supabase Realtime doesn't work on this project's current
-- supabase-js/realtime-js version (see 20260714080000_presence_authorization.sql
-- for the RLS half of that dead end: policies alone weren't enough, the client
-- library predates the "private channels" plumbing Presence now requires).
--
-- Fall back to a plain heartbeat column: the player page updates this
-- periodically while mounted, and the host derives online/offline from how
-- recently it was touched. This is what powers the "who's currently
-- connected" list in the mid-quiz rejoin panel.

alter table public.participants
  add column last_seen timestamptz;
