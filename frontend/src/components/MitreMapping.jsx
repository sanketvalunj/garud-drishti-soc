import React from 'react';
import { ShieldAlert } from 'lucide-react';

const MitreMapping = ({ techniques = [] }) => {
    const defaultTechniques = [
        { id: 'T1078', name: 'Valid Accounts' },
        { id: 'T1059', name: 'Command Execution' },
        { id: 'T1041', name: 'Data Exfiltration' }
    ];

    const data = techniques.length > 0 ? techniques : defaultTechniques;

    return (
        <div className="glass-panel p-6 rounded-2xl h-full">
            <h3 className="heading-lg text-white mb-6 flex items-center gap-2">
                <ShieldAlert className="text-red-500" size={24} />
                MITRE ATT&CK Mapping
            </h3>

            <div className="flex flex-wrap gap-3">
                {data.map((tech, idx) => (
                    <div
                        key={idx}
                        className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg overflow-hidden hover:border-red-500/50 transition-colors shadow-md group cursor-default"
                    >
                        <div className="bg-red-500/20 text-red-400 px-3 py-2 font-mono font-bold text-sm border-r border-slate-700 group-hover:bg-red-500/30 transition-colors">
                            {tech.id}
                        </div>
                        <div className="px-4 py-2 text-slate-200 text-sm font-medium">
                            {tech.name}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MitreMapping;
