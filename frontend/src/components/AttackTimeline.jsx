import React from 'react';
import { Activity } from 'lucide-react';

const AttackTimeline = ({ timeline = [] }) => {
    const defaultTimeline = [
        { time: '12:11', event: 'login_failed' },
        { time: '12:11', event: 'powershell_execution' },
        { time: '12:13', event: 'data_download' },
        { time: '12:25', event: 'privilege_escalation' }
    ];

    const data = timeline.length > 0 ? timeline : defaultTimeline;

    return (
        <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
            <h3 className="heading-lg text-white mb-6 flex items-center gap-2">
                <Activity className="text-blue-500" size={24} />
                Attack Timeline
            </h3>

            <div className="relative border-l-2 border-slate-700 ml-3 mt-4 flex-grow">
                {data.map((item, index) => (
                    <div key={index} className="mb-8 ml-6 relative">
                        {/* Timeline Node */}
                        <div className="absolute w-4 h-4 bg-blue-500 rounded-full -left-[33px] top-1 border-4 border-slate-900"></div>

                        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/60 shadow-md hover:border-blue-500/50 transition-colors">
                            <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                                {item.time}
                            </span>
                            <div className="mt-2 text-slate-200 font-medium tracking-wide">
                                {item.event}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AttackTimeline;
