-- --------------------------------------------------------------------------------------
-- PHASE 2: ENABLE RLS (SAFE MODE / PERMISSIVE)
-- This migration enables Row Level Security on all tenant tables, but IMMEDIATELY 
-- applies a permissive "pass-through" policy.
--
-- PRODUCTION IMPACT: ZERO. 
-- Existing queries will continue to function exactly as they do today because 
-- `USING (true)` bypasses the engine-level restrictions while the switch is flipped "on".
-- --------------------------------------------------------------------------------------

DO $$
DECLARE
    t_name text;
    -- A comprehensive list of tables that require workspace isolation
    tables_array text[] := ARRAY[
        'ActionQueueItem', 'AgentConnection', 'AIInsight', 'AlertRule', 'ApiKey', 
        'Asset', 'AuditLog', 'DiscoveryScan', 'Location', 'MaintenanceWindow', 
        'MdmProfile', 'NetworkDevice', 'NotificationWebhook', 'PatchPolicy', 
        'ReportSchedule', 'Script', 'ScriptExecution', 'ScriptSchedule', 
        'Ticket', 'ZtnaPolicy'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_array LOOP
        -- 1. Turn on the engine for the table (ENABLE RLS is idempotent)
        EXECUTE format('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY;', t_name);

        -- 2. Drop any pre-existing permissive policy, then add the safe pass-through
        EXECUTE format(
            'DROP POLICY IF EXISTS "rls_permissive_migration" ON "%s";',
            t_name
        );
        EXECUTE format(
            'CREATE POLICY "rls_permissive_migration" ON "%s" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);',
            t_name
        );
    END LOOP;
END $$;
