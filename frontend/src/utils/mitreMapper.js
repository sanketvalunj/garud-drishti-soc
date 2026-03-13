/**
 * MITRE ATT&CK Mapping Utility
 * Maps incident stories and summaries to attack stages.
 */

// Define standard kill-chain stages
export const MITRE_STAGES = [
    { id: 'initial_access', label: 'Initial Access', color: 'blue' },
    { id: 'execution', label: 'Execution', color: 'blue' },
    { id: 'persistence', label: 'Persistence', color: 'indigo' },
    { id: 'privilege_escalation', label: 'Privilege Escalation', color: 'violet' },
    { id: 'lateral_movement', label: 'Lateral Movement', color: 'orange' },
    { id: 'exfiltration', label: 'Exfiltration', color: 'red' }
];

// Helper to determine active stages from text analysis
export const mapIncidentToMitre = (incident) => {
    if (!incident) return { activeStages: new Set(), coverage: [] };

    const text = (incident.story + " " + incident.summary).toLowerCase();
    const activeStages = new Set();
    const coverage = [];

    // 1. Initial Access
    if (text.includes('login failed') || text.includes('phishing') || text.includes('access') || text.includes('brute force')) {
        activeStages.add('initial_access');
        coverage.push({
            stage: 'initial_access',
            trigger: 'Suspicious authentication or access attempt detected',
            timestamp: incident.timestamp // approximate
        });
    }

    // 2. Execution
    if (text.includes('powershell') || text.includes('cmd') || text.includes('script') || text.includes('execution')) {
        activeStages.add('execution');
        coverage.push({
            stage: 'execution',
            trigger: 'Command line or script execution observed',
            timestamp: incident.timestamp
        });
    }

    // 3. Persistence
    if (text.includes('persistence') || text.includes('scheduled task') || text.includes('registry') || text.includes('service')) {
        activeStages.add('persistence');
        coverage.push({
            stage: 'persistence',
            trigger: 'System change indicating persistence mechanism',
            timestamp: incident.timestamp
        });
    }

    // 4. Privilege Escalation
    if (text.includes('privilege') || text.includes('admin') || text.includes('root') || text.includes('escalation')) {
        activeStages.add('privilege_escalation');
        coverage.push({
            stage: 'privilege_escalation',
            trigger: 'Attempt to gain elevated permissions',
            timestamp: incident.timestamp
        });
    }

    // 5. Lateral Movement
    if (text.includes('moved from') || text.includes('lateral') || text.includes('ssh') || text.includes('rdp') || text.includes('remote')) {
        activeStages.add('lateral_movement');
        coverage.push({
            stage: 'lateral_movement',
            trigger: 'Movement between internal assets detected',
            timestamp: incident.timestamp
        });
    }

    // 6. Exfiltration
    if (text.includes('download') || text.includes('export') || text.includes('upload') || text.includes('exfiltration') || text.includes('data loss')) {
        activeStages.add('exfiltration');
        coverage.push({
            stage: 'exfiltration',
            trigger: 'Data transfer or export activity observed',
            timestamp: incident.timestamp
        });
    }

    // Always assume Initial Access if nothing else found but incident exists
    if (activeStages.size === 0) {
        activeStages.add('initial_access');
    }

    return { activeStages, coverage };
};
