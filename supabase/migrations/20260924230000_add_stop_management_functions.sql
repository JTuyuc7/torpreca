-- TOR-137: the dashboard can now edit and reorder a route's stops.
-- customer_name/address are encrypted at rest, so editing them needs an RPC
-- (same reason as create/complete/delay_stop_encrypted). Deleting a stop is a
-- plain DELETE and needs no function.

CREATE OR REPLACE FUNCTION public.update_stop_encrypted (
  p_id            uuid,
  p_customer_name text,
  p_address       text,
  p_lat           numeric,
  p_lng           numeric,
  p_instructions  text,
  p_secret_key    text
)
  RETURNS TABLE (
    id             uuid,
    route_id       uuid,
    order_index    integer,
    customer_name  text,
    address        text,
    lat            numeric,
    lng            numeric,
    instructions   text,
    status         public.stop_status,
    estimated_time timestamp with time zone,
    completed_time timestamp with time zone,
    created_at     timestamp with time zone,
    updated_at     timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, extensions
  AS $function$
BEGIN
    RETURN QUERY
    UPDATE public.stops
    SET customer_name = pgp_sym_encrypt(p_customer_name, p_secret_key),
        address       = pgp_sym_encrypt(p_address, p_secret_key),
        lat           = p_lat,
        lng           = p_lng,
        instructions  = p_instructions
    WHERE stops.id = p_id AND stops.status <> 'completed'
    RETURNING stops.id, stops.route_id, stops.order_index,
              pgp_sym_decrypt(stops.customer_name, p_secret_key)::text,
              pgp_sym_decrypt(stops.address, p_secret_key)::text,
              stops.lat, stops.lng, stops.instructions, stops.status,
              stops.estimated_time, stops.completed_time,
              stops.created_at, stops.updated_at;
END;
$function$;

-- Renumbers a route's stops 1..n following p_stop_ids. (route_id, order_index)
-- is UNIQUE, so the rows are first moved out of the way (+ 100000) and then
-- assigned their final index — all inside this one function call/transaction.
-- Takes no secret key, so unlike the other stop functions it is NOT callable
-- with the public anon key: only service_role (the backend) may execute it.
CREATE OR REPLACE FUNCTION public.reorder_stops (
  p_route_id  uuid,
  p_stop_ids  uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
BEGIN
    UPDATE public.stops SET order_index = order_index + 100000
    WHERE route_id = p_route_id;

    UPDATE public.stops s
    SET order_index = t.new_index
    FROM (
      SELECT id, ordinality::integer AS new_index
      FROM unnest(p_stop_ids) WITH ORDINALITY AS u(id, ordinality)
    ) t
    WHERE s.id = t.id AND s.route_id = p_route_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_stop_encrypted(uuid, text, text, numeric, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_stop_encrypted(uuid, text, text, numeric, numeric, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.reorder_stops(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_stops(uuid, uuid[]) TO service_role;
