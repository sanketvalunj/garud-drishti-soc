import React from 'react';
import { FileJson, ChevronRight } from 'lucide-react';

const PlaybookViewer = ({ steps = [] }) => {
    const defaultSteps = [
        "Disable compromised account",
        "Audit admin activity",
        "Reset credentials",
        "Check lateral movement"
    ];

    const data = steps.length > 0 ? steps : defaultSteps;

    return (
        <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
            <h3 className="heading-lg text-white mb-6 flex items-center gap-2">
                <FileJson className="text-emerald-500" size={24} />
                Generated Playbook Actions
            </h3>

            <div className="space-y-3 flex-grow">
                {data.map((step, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-emerald-500/20 hover:border-emerald-500/50 transition-colors"
                    >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                            {index + 1}
                        </div>
                        <ChevronRight className="text-slate-500 flex-shrink-0" size={16} />
                        <span className="text-slate-200 font-medium">
                            {step}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlaybookViewer;
