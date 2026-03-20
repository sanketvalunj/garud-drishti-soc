import React from 'react';
import { Bot, Cpu } from 'lucide-react';

const LLMReasoningViewer = ({ explanation = "" }) => {
    const defaultExplanation = `Privilege escalation detected.
Core banking asset targeted.
Possible data exfiltration activity.`;

    const displayText = explanation || defaultExplanation;

    return (
        <div className="glass-panel p-6 rounded-2xl h-full flex flex-col relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mx-10 -my-10 z-0"></div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6 border-b border-slate-700/50 pb-4">
                    <h3 className="heading-lg text-white flex items-center gap-2">
                        <Bot className="text-blue-400" size={24} />
                        LLM Reasoning Output
                    </h3>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20 flex items-center gap-1">
                            <Cpu size={12} />
                            LLM Model: Mistral (Ollama)
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 px-2">
                            Inference Mode: Offline
                        </span>
                    </div>
                </div>

                <div className="flex-grow bg-slate-900/60 rounded-xl p-4 border border-slate-700/50 text-sm leading-relaxed text-slate-300 shadow-inner relative">
                    <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-lg">
                        AI Generated Explanation
                    </div>
                    {displayText.split('\n').map((line, i) => (
                        <p key={i} className="mb-2 last:mb-0">{line}</p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LLMReasoningViewer;
