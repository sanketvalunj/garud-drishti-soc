import React from 'react';

const AIPipeline = () => {
    const stages = [
        { id: 1, name: 'Logs', status: 'Completed' },
        { id: 2, name: 'UEBA Detection', status: 'Completed' },
        { id: 3, name: 'Correlation Engine', status: 'Completed' },
        { id: 4, name: 'Incident Builder', status: 'Completed' },
        { id: 5, name: 'AI Reasoning Layer', status: 'Processing' },
        { id: 6, name: 'Playbook Generator', status: 'Alert' },
        { id: 7, name: 'Automation Engine', status: 'Alert' }
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
            case 'Processing': return 'bg-blue-500/20 border-blue-500/50 text-blue-400 animate-pulse';
            case 'Alert': return 'bg-red-500/20 border-red-500/50 text-red-400';
            default: return 'bg-slate-500/20 border-slate-500/50 text-slate-400';
        }
    };

    return (
        <div className="glass-panel p-6 rounded-2xl w-full">
            <h3 className="heading-lg text-white mb-6">AI SOC Pipeline Visualization</h3>
            <div className="flex flex-col md:flex-row justify-between items-center relative gap-4 md:gap-0">
                {/* Horizontal Line connector for large screens */}
                <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-slate-700 -z-10 transform -translate-y-1/2 mx-8" />

                {stages.map((stage, idx) => (
                    <div key={stage.id} className="flex flex-col items-center relative z-10 w-full md:w-auto">
                        <div className={`
                            flex items-center justify-center 
                            w-12 h-12 rounded-full border-2 mb-3
                            ${getStatusColor(stage.status)}
                            shadow-lg backdrop-blur-sm
                        `}>
                            <span className="font-bold">{stage.id}</span>
                        </div>
                        <div className="text-center w-28">
                            <p className="text-xs font-semibold text-slate-200">{stage.name}</p>
                            <p className="text-[10px] uppercase tracking-wider mt-1 text-slate-400">{stage.status}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIPipeline;
