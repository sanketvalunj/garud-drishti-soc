import axios from 'axios';

// Create axios instance with default config
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10s timeout
});

export default {
    // Get all incidents
    getIncidents: async () => {
        try {
            const response = await apiClient.get('/incidents');
            return response.data;
        } catch (error) {
            console.error('API Error: getIncidents', error);
            throw error;
        }
    },

    // Get reasoning for a specific incident
    getIncidentReasoning: async (id) => {
        try {
            const response = await apiClient.get(`/reasoning/${id}`);
            return response.data;
        } catch (error) {
            console.error('API Error: getIncidentReasoning', error);
            throw error;
        }
    },

    // Get MITRE mapping for a specific incident
    getMitreMapping: async (id) => {
        try {
            const response = await apiClient.get(`/mitre/${id}`);
            return response.data;
        } catch (error) {
            console.error('API Error: getMitreMapping', error);
            throw error;
        }
    },

    // Get all playbooks
    getPlaybooks: async () => {
        try {
            const response = await apiClient.get('/playbooks');
            return response.data;
        } catch (error) {
            console.error('API Error: getPlaybooks', error);
            throw error;
        }
    },

    // check backend health
    getHealth: async () => {
        try {
            const response = await apiClient.get('/health');
            return response.data;
        } catch (error) {
            return { status: 'offline', error: error.message };
        }
    },

    // --- Pipeline Control ---
    runPipeline: async () => {
        try {
            // Using the new admin/operational endpoint
            const response = await apiClient.post('/admin/run-pipeline');
            return response.data;
        } catch (error) {
            console.error('API Error: runPipeline', error);
            // Fallback to old endpoint if needed, or just throw
            throw error;
        }
    },

    // --- Admin Endpoints ---
    getSystemHealth: () => apiClient.get('/admin/health').then(res => res.data),
    getModelStatus: () => apiClient.get('/admin/model-status').then(res => res.data),
    getPipelineStatus: () => apiClient.get('/admin/pipeline-status').then(res => res.data),
    getStorageStatus: () => apiClient.get('/admin/storage').then(res => res.data),
    getNodes: () => apiClient.get('/admin/nodes').then(res => res.data),

    // Get automation execution reports
    getAutomation: async () => {
        try {
            const response = await apiClient.get('/automation');
            return response.data;
        } catch (error) {
            console.error('API Error: getAutomation', error);
            return [];
        }
    },

};
