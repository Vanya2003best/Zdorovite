-- ===================================================================
-- Enable Realtime broadcasting on messages table.
-- After running this, clients can `supabase.channel().on('postgres_changes', ...)`
-- subscribe to INSERT events and receive messages instantly.
-- ===================================================================

alter publication supabase_realtime add table public.messages;
