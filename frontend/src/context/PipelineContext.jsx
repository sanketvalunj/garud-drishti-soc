import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';

const PipelineContext = createContext();

export const usePipeline = () => useContext(PipelineContext);

export const PipelineProvider = ({ children }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [lastRun, setLastRun] = useState(null);

    const runPipeline = async () => {
        if (isRunning) return;
        setIsRunning(true);
        try {
            await api.runPipeline();
            setLastRun(new Date());
            // In a real app, we'd trigger a global re-fetch here
            // distinct from this context, or expose a refresh signal
        } catch (error) {
            console.error("Pipeline execution failed", error);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <PipelineContext.Provider value={{ isRunning, lastRun, runPipeline }}>
            {children}
        </PipelineContext.Provider>
    );
};
