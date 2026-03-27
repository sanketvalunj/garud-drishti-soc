import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';

const PipelineContext = createContext();

export const usePipeline = () => useContext(PipelineContext);

export const PipelineProvider = ({ children }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [lastRun, setLastRun] = useState(null);
    const [currentStage, setCurrentStage] = useState(6); // Default 6 (completed/idle)

    const runPipeline = async () => {
        if (isRunning) return;
        setIsRunning(true);
        try {
            setCurrentStage(1);
            const data = await api.runPipeline();
            setCurrentStage(6);
            setLastRun(new Date());
            return data;
        } catch (error) {
            console.error("Pipeline run failed", error);
            setCurrentStage(0);
            throw error;
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <PipelineContext.Provider value={{ isRunning, lastRun, runPipeline, currentStage }}>
            {children}
        </PipelineContext.Provider>
    );
};
