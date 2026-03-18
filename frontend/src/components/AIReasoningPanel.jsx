import React from 'react';
import { Shield, FileCheck, DollarSign } from 'lucide-react';

const AIReasoningPanel = ({ reasoningData }) => {
    // Determine static fallback if data not provided
    const defaultData = {
        risk: { score: 8, severity: 'HIGH' },
        compliance: { score: 7, violations: 'MITRE T1078' },
        business: { impact: 'CRITICAL', target: 'Core Banking' }
    };

    // Safety check for reasoningData mapping
    const riskData = reasoningData?.risk_agent || defaultData.risk;
    const compData = reasoningData?.compliance_agent || defaultData.compliance;
    const bizData = reasoningData?.business_agent || defaultData.business;

    return (
        <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
            <h3 className="heading-lg text-white mb-6">AI Multi-Agent Reasoning Panel</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
                {/* Risk Agent Card */}
                <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700 hover:border-red-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
                            <Shield size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-slate-200">Risk Agent</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                            <span className="text-sm text-slate-400">Risk Score</span>
                            <span className="font-mono text-lg font-bold text-white">{riskData.score || riskData.risk_score || defaultData.risk.score}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Severity</span>
                            <span className="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-400 rounded uppercase">
                                {riskData.severity || 'HIGH'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Compliance Agent Card */}
                <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700 hover:border-amber-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                            <FileCheck size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-slate-200">Compliance Agent</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                            <span className="text-sm text-slate-400">Compliance Score</span>
                            <span className="font-mono text-lg font-bold text-white">{compData.score || compData.compliance_score || defaultData.compliance.score}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Policy Violations</span>
                            <span className="text-sm font-medium text-amber-400">
                                {compData.violations || compData.policy_violations || defaultData.compliance.violations}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Business Impact Agent Card */}
                <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
                            <DollarSign size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-slate-200">Business Impact</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                            <span className="text-sm text-slate-400">Impact Level</span>
                            <span className="text-xs font-bold px-2 py-1 bg-blue-500/20 text-blue-400 rounded uppercase">
                                {bizData.impact || bizData.impact_level || defaultData.business.impact}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Target Asset</span>
                            <span className="text-sm font-medium text-slate-200">
                                {bizData.target || bizData.target_asset || defaultData.business.target}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIReasoningPanel;
