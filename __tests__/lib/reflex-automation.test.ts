/** @jest-environment node */
import { assessConsequence, AutonomyLevel, AutomationAction } from '@/lib/reflex/automation';

describe('REFLEX Automation Engine - Consequence Assessment', () => {
    describe('run_script action type', () => {
        it('should classify high blast radius scripts as high risk and require approval', () => {
            const action: AutomationAction = { type: 'run_script', scriptName: 'Deploy Update' };
            const result = assessConsequence(action, 'auto', 10);

            expect(result.riskLevel).toBe('high');
            expect(result.requiresApproval).toBe(true);
            expect(result.reversible).toBe(false);
            expect(result.affectedAssets).toBe(10);
        });

        it('should classify low blast radius scripts as low risk but still require approval if autonomy is not auto', () => {
            const action: AutomationAction = { type: 'run_script', scriptName: 'Restart Service' };
            const result = assessConsequence(action, 'confirm', 1);

            expect(result.riskLevel).toBe('low');
            expect(result.requiresApproval).toBe(true);
            expect(result.reversible).toBe(false);
        });

        it('should classify low blast radius scripts as low risk and allow auto execution if autonomy is auto', () => {
            const action: AutomationAction = { type: 'run_script', scriptName: 'Clear Cache' };
            const result = assessConsequence(action, 'auto', 1);

            expect(result.riskLevel).toBe('low');
            expect(result.requiresApproval).toBe(false);
            expect(result.reversible).toBe(false);
        });
    });

    describe('restart_agent action type', () => {
        it('should classify high blast radius agent restarts as medium risk', () => {
            const action: AutomationAction = { type: 'restart_agent' };
            const result = assessConsequence(action, 'auto', 5);

            expect(result.riskLevel).toBe('medium');
            expect(result.requiresApproval).toBe(false); // Because autonomy is auto
            expect(result.reversible).toBe(true);
        });

        it('should classify agent restarts as requiring approval if autonomy is suggest', () => {
            const action: AutomationAction = { type: 'restart_agent' };
            const result = assessConsequence(action, 'suggest', 1);

            expect(result.riskLevel).toBe('low');
            expect(result.requiresApproval).toBe(true);
            expect(result.reversible).toBe(true);
        });
    });

    describe('send_notification action type', () => {
        it('should always classify notifications as safe and not require approval', () => {
            const action: AutomationAction = { type: 'send_notification' };
            const result = assessConsequence(action, 'suggest', 100); // High blast radius should not matter

            expect(result.riskLevel).toBe('safe');
            expect(result.requiresApproval).toBe(false);
            expect(result.reversible).toBe(true);
            expect(result.affectedAssets).toBe(0);
        });
    });

    describe('create_alert action type', () => {
        it('should always classify alert creation as safe and not require approval', () => {
            const action: AutomationAction = { type: 'create_alert' };
            const result = assessConsequence(action, 'confirm', 50);

            expect(result.riskLevel).toBe('safe');
            expect(result.requiresApproval).toBe(false);
            expect(result.reversible).toBe(true);
            expect(result.affectedAssets).toBe(0);
        });
    });

    describe('unknown action type', () => {
        it('should fallback to medium risk and require approval for unknown actions', () => {
            // @ts-ignore - purposefully passing invalid action
            const action: AutomationAction = { type: 'unknown_action' };
            const result = assessConsequence(action, 'auto', 1);

            expect(result.riskLevel).toBe('medium');
            expect(result.requiresApproval).toBe(true);
            expect(result.reversible).toBe(false);
        });
    });
});
