-- Remaining return lifecycle and saved-view persistence are exposed as targeted
-- tenant-scoped operations; no workspace snapshot is written in production.
alter table public.saved_order_views add column if not exists is_default boolean not null default false;
create unique index if not exists saved_order_views_one_default_idx on public.saved_order_views(business_id,user_id) where is_default;

create or replace function public.mutate_order_return(p_return_id uuid, p_action text, p_detail text default '', p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.returns%rowtype; actor uuid:=auth.uid(); next_status text;
begin
 select * into r from public.returns where id=p_return_id for update; if not found then raise exception 'Return not found'; end if;
 if not public.has_business_role(r.business_id,array['owner','admin','operations','fulfillment']) then raise exception 'Unauthorized return mutation' using errcode='42501'; end if;
 if p_idempotency_key is not null and exists(select 1 from public.activity_events where business_id=r.business_id and entity_type='return' and entity_id=r.id and detail=p_idempotency_key) then return jsonb_build_object('idempotent',true,'return_id',r.id); end if;
 next_status:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' when 'in_transit' then 'in_transit' when 'close' then 'closed' else null end;
 if next_status is null then raise exception 'Unknown return action'; end if;
 if (p_action='approve' and r.status<>'requested') or (p_action='reject' and r.status<>'requested') or (p_action='in_transit' and r.status<>'approved') or (p_action='close' and r.status<>'received') then raise exception 'Illegal return transition'; end if;
 update public.returns set status=next_status,updated_at=now() where id=r.id; insert into public.activity_events(business_id,actor_id,action,entity_type,entity_id,detail) values(r.business_id,actor,'Return '||next_status,'return',r.id,coalesce(p_idempotency_key,p_detail)); insert into public.notifications(business_id,severity,title,detail,href) values(r.business_id,'info','Return updated',coalesce(p_detail,next_status),'/orders'); return jsonb_build_object('idempotent',false,'return_id',r.id,'status',next_status);
end $$;
revoke all on function public.mutate_order_return(uuid,text,text,text) from public; grant execute on function public.mutate_order_return(uuid,text,text,text) to authenticated;
