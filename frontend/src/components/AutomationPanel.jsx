import React from 'react';
import { Settings, CheckCircle } from 'lucide-react';

const AutomationPanel = ({ actions = [] }) => {
    const defaultActions = [
        { action: "Disable account", status: "simulated" },
        { action: "Audit activity", status: "simulated" },
        { action: "Reset credentials", status: "simulated" }
    ];

    const data = actions.length > 0 ? actions : defaultActions;

    return (
        <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
            <h3 className="heading-lg text-white mb-6 flex items-center gap-2">
                <Settings className="text-violet-500" size={24} />
                Automation Results
            </h3>

            <div className="space-y-4 flex-grow">
                {data.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-800/40 border border-slate-700 rounded-xl hover:bg-slate-800/60 transition-colors">
                        <span className="text-slate-200 flex items-center gap-2 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                            {item.action}
                        </span>

                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-wider font-bold px-2 py-1 rounded bg-violet-500/20 text-violet-400">
                                {item.status}
                            </span>
                            <CheckCircle size={18} className="text-emerald-400" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                <span>Execution Engine: <span className="text-slate-300">Garud Automator</span></span>
                <span>Mode: <span className="text-emerald-400">Autonomous</span></span>
            </div>
        </div>
    );
};

export default AutomationPanel;
