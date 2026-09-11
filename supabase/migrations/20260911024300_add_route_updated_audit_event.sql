-- TOR-30: dashboard gets a PATCH /routes/:id to edit a pending route
-- (reassign driver/vehicle, change code/date/plannedKm). That mutation needs
-- its own audit_logs event, distinct from `route.created`.

ALTER TYPE "public"."audit_action" ADD VALUE 'route.updated';