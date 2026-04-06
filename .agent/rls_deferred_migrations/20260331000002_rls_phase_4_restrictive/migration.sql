-- --------------------------------------------------------------------------------------
-- PHASE 4: ADD REAL POLICIES (SHADOW MODE)
-- This migration adds the actual restrictive Row Level Security policies.
-- Because the PERMISSIVE 'using (true)' policy from Phase 2 is still active,
-- queries will NOT suddenly start failing. They will evaluate against both, and pass!
-- 
-- PRODUCTION IMPACT: ZERO.
-- Backend context injections will begin testing against this without dropping 
-- missing-context requests into an error state yet.
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
        -- Create the restrictive policy that checks the `app.workspace_id` setting injected by the backend
        -- `is not null` acts as the failsafe to prevent returning the entire table if context is lost
        EXECUTE format(
            'CREATE POLICY "rls_enforce_isolation" ON "%s" AS PERMISSIVE FOR ALL USING (
                current_setting(''app.workspace_id'', true) IS NOT NULL 
                AND "workspaceId" = current_setting(''app.workspace_id'', true)
            ) WITH CHECK (
                current_setting(''app.workspace_id'', true) IS NOT NULL 
                AND "workspaceId" = current_setting(''app.workspace_id'', true)
            );', 
            t_name
        );
    END LOOP;
END $$;
