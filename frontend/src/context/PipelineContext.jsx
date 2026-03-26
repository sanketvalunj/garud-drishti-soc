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
        setCurrentStage(0);
        
        try {
            // API to integrate — Simulate stage progression
            for (let i = 1; i <= 6; i++) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                setCurrentStage(i);
            }
            
            // Finalize
            setLastRun(new Date());
            api.runPipeline().catch(err => console.error("Background API run failed", err));
        } catch (error) {
            console.error("Pipeline simulation failed", error);
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
