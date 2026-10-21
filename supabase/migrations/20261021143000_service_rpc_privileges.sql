-- T-042 S9 — keep service-only RPCs off anon/authenticated.
--
-- Supabase grants EXECUTE on new public functions to the API roles in some
-- environments; revoking PUBLIC alone is not enough. These RPCs are only called
-- by Netlify functions holding the service key.
begin;

revoke all on function public.claim_content_check_v1(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.record_content_check_result_v1(text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.enqueue_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) from public, anon, authenticated;
revoke all on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) from public, anon, authenticated;

grant execute on function public.claim_content_check_v1(text, text, integer)
  to service_role;
grant execute on function public.record_content_check_result_v1(text, uuid, boolean)
  to service_role;
grant execute on function public.enqueue_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) to service_role;
grant execute on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) to service_role;

commit;
