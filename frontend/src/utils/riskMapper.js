/**
 * Maps raw playbook steps and incident data to structured Risk Categories.
 * Provides logic to categorize actions into Containment, Prevention, and Monitoring.
 */

export const mapRiskToCategories = (playbook, incident) => {
    if (!playbook) return null;

    const sections = {
        containment: [],
        prevention: [],
        monitoring: []
    };

    const steps = playbook.playbook?.steps || playbook.response_steps || [];

    steps.forEach(step => {
        const text = step.toLowerCase();

        // Categorization Rules
        if (text.match(/block|isolate|disable|revoke|stop|suspend|quarantine|kill/)) {
            sections.containment.push(step);
        } else if (text.match(/monitor|watch|audit|log|alert|check|verify|scan/)) {
            sections.monitoring.push(step);
        } else {
            // Default to prevention/remediation for other actions
            sections.prevention.push(step);
        }
    });

    // If a section is empty, look for recommendations
    if (playbook.playbook?.recommended_actions) {
        playbook.playbook.recommended_actions.forEach(action => {
            const text = action.toLowerCase();
            if (text.match(/patch|update|educate|policy|configure|enable/)) {
                sections.prevention.push(action);
            }
        });
    }

    // Infer Risk Type if not present
    let riskType = playbook.threat_type || 'General Threat';
    if (incident) {
        if (incident.summary.toLowerCase().includes('lateral')) riskType = 'Lateral Movement';
        else if (incident.summary.toLowerCase().includes('exfiltration')) riskType = 'Data Exfiltration';
        else if (incident.summary.toLowerCase().includes('privilege')) riskType = 'Privilege Escalation';
        else if (incident.summary.toLowerCase().includes('ransomware')) riskType = 'Ransomware';
        else if (incident.summary.toLowerCase().includes('phishing')) riskType = 'Phishing';
    }

    return {
        riskType,
        sections
    };
};

export const getRiskColor = (riskType) => {
    switch (riskType?.toLowerCase()) {
        case 'lateral movement': return 'violet'; // Network traversal
        case 'data exfiltration': return 'red'; // Data loss
        case 'privilege escalation': return 'orange'; // Access gain
        case 'ransomware': return 'red';
        case 'phishing': return 'blue';
        default: return 'slate';
    }
};
