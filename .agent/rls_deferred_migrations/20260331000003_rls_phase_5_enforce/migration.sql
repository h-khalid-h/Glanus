-- --------------------------------------------------------------------------------------
-- PHASE 5: THE ENFORCEMENT FLIP (DANGER!)
-- This migration REMOVES the permissive pass-through policy.
-- After this is executed, any database query sent WITHOUT `set_config('app.workspace_id')` 
-- will instantly fail by returning 0 rows.
-- 
-- DO NOT APPLY IN PRODUCTION until APM logs show 0 missing-context queries for 24+ hours
-- --------------------------------------------------------------------------------------

DO $$
DECLARE
    t_name text;
    tables_array text[] := ARRAY[
        'ActionQueueItem', 'AgentConnection', 'AIInsight', 'AlertRule', 'ApiKey', 
        'Asset', 'AuditLog', 'DiscoveryScan', 'Location', 'MaintenanceWindow', 
        'MdmProfile', 'NetworkDevice', 'NotificationWebhook', 'PatchPolicy', 
        'ReportSchedule', 'Script', 'ScriptExecution', 'ScriptSchedule', 
        'Ticket', 'ZtnaPolicy'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_array LOOP
        -- 1. Drop the permissive crutch
        EXECUTE format('DROP POLICY IF EXISTS "rls_permissive_migration" ON "%s";', t_name);
        
        -- 2. Force RLS to apply even to the table owner (`glanus_app` user)
        EXECUTE format('ALTER TABLE "%s" FORCE ROW LEVEL SECURITY;', t_name);
    END LOOP;
END $$;
