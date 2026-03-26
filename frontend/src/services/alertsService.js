export const fetchAlerts = async () => {
    // API to integrate
    // return await fetch("/api/alerts").then(res => res.json());

    // Mock data for initial development
    return [
        {
            id: "ALT-1023",
            title: "Privilege Escalation detected",
            source: "EDR",
            entity: "emp_104",
            severity: "high",
            fidelity: 0.94,
            status: "investigating",
            timestamp: "2 min ago",
            description: "Suspicious privilege escalation detected on endpoint via encoded PowerShell command."
        },
        {
            id: "ALT-1024",
            title: "Unusual Data Outbound",
            source: "SIEM",
            entity: "srv-prod-01",
            severity: "medium",
            fidelity: 0.76,
            status: "investigating",
            timestamp: "15 min ago",
            description: "High volume of data transfer to unknown external IP 203.0.113.45."
        },
        {
            id: "ALT-1025",
            title: "Brute Force Attempt",
            source: "UEBA",
            entity: "j_smith",
            severity: "low",
            fidelity: 0.82,
            status: "resolved",
            timestamp: "1 hour ago",
            description: "Multiple failed login attempts followed by a successful login from a new location."
        },
        {
            id: "ALT-1026",
            title: "Malware Signature Match",
            source: "EDR",
            entity: "user-pc-44",
            severity: "high",
            fidelity: 0.98,
            status: "escalated",
            timestamp: "5 min ago",
            description: "Known ransomware signature detected by endpoint protection agent."
        },
        {
            id: "ALT-1027",
            title: "Policy Violation: USB Access",
            source: "SIEM",
            entity: "admin_dev",
            severity: "low",
            fidelity: 0.65,
            status: "investigating",
            timestamp: "3 hour ago",
            description: "Unauthorized USB storage device connected to sensitive workstation."
        }
    ];
};
