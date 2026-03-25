/**
 * SOC Event Streaming Service
 * Handles Server-Sent Events (SSE) connection.
 */

const STREAM_URL = "http://127.0.0.1:8000/stream-events";

let eventSource = null;

export const connectEventStream = (onMessage, onError) => {
    if (eventSource) {
        return; // Already connected
    }

    eventSource = new EventSource(STREAM_URL);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onMessage(data);
        } catch (e) {
            console.error("Failed to parse stream event", e);
        }
    };

    eventSource.onerror = (err) => {
        console.error("Stream connection error", err);
        if (onError) onError(err);
        eventSource.close();
        eventSource = null;
    };

    console.log("Connected to SOC Event Stream");
};

export const disconnectEventStream = () => {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
        console.log("Disconnected from SOC Event Stream");
    }
};
