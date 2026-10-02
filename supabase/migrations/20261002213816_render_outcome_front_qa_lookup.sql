-- Targeted private final-render front QA lookup.
-- Applied to production Supabase as migration 20261002213816.
-- Keeps secondary-view authorization O(1) by job instead of scanning the recent outcome ledger.

create or replace function public.designer_render_outcome_front_qa(
  p_job_id text
)
returns table(
  job_id text,
  concept_id text,
  shirt_id text,
  pant_id text,
  qa_status text,
  qa_payload jsonb
)
language sql
security definer
set search_path='public','private'
as $$
  select o.job_id,o.concept_id,o.shirt_id,o.pant_id,o.qa_status,o.qa_payload
  from private.designer_render_outcomes o
  where o.job_id=left(trim(p_job_id),180)
    and o.view='front'
  order by o.created_at desc
  limit 1
$$;

revoke all on function public.designer_render_outcome_front_qa(text) from public,anon,authenticated;
grant execute on function public.designer_render_outcome_front_qa(text) to service_role;
