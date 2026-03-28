import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const LiveStreamContext = createContext(null);

const MAX_EVENTS = 100;
const RECONNECT_DELAY_MS = 3000;

const resolveStreamUrl = () => {
    const base = (import.meta.env.VITE_API_BASE || window.location.origin || '').replace(/\/$/, '');
    return `${base}/stream-events`;
};

const normalizeSeverity = (rawSeverity) => {
    const sev = String(rawSeverity || '').toLowerCase();
    if (sev === 'critical' || sev === 'high') return 'high';
    if (sev === 'warning' || sev === 'medium') return 'medium';
    return 'low';
};

const toUiEvent = (data) => {
    const ts = new Date(data?.timestamp || Date.now());
    return {
        id: data?.event_id || `evt-${Date.now()}-${Math.random()}`,
        time: ts.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }),
        type: data?.event_type || data?.event_category || 'EVENT',
        entity: data?.user || data?.entity_id || '-',
        severity: normalizeSeverity(data?.severity),
        source: data?.source || data?.source_ip || '-',
        incidentId: data?.incident_id || '',
        receivedAt: Date.now(),
    };
};

export const LiveStreamProvider = ({ children }) => {
    const [liveEvents, setLiveEvents] = useState([]);
    const [isStreamEnabled, setIsStreamEnabled] = useState(true);
    const [connectionState, setConnectionState] = useState('connecting');
    const [lastEventAt, setLastEventAt] = useState(null);

    const eventSourceRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const enabledRef = useRef(isStreamEnabled);

    const streamUrl = useMemo(resolveStreamUrl, []);

    useEffect(() => {
        enabledRef.current = isStreamEnabled;
    }, [isStreamEnabled]);

    const clearReconnectTimer = () => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    };

    const closeEventSource = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    };

    useEffect(() => {
        if (!isStreamEnabled) {
            setConnectionState('paused');
            clearReconnectTimer();
            closeEventSource();
            return;
        }

        let disposed = false;

        const connect = () => {
            if (disposed || !enabledRef.current || eventSourceRef.current) {
                return;
            }

            setConnectionState((prev) => (prev === 'reconnecting' ? 'reconnecting' : 'connecting'));

            const es = new EventSource(streamUrl);
            eventSourceRef.current = es;

            es.onopen = () => {
                if (disposed || !enabledRef.current) return;
                setConnectionState('live');
            };

            es.onmessage = (msg) => {
                if (disposed || !enabledRef.current) return;
                try {
                    const data = JSON.parse(msg.data);
                    const normalized = toUiEvent(data);

                    setLiveEvents((prev) => [normalized, ...prev].slice(0, MAX_EVENTS));
                    setLastEventAt(normalized.receivedAt);
                } catch (error) {
                    console.error('[LiveStream] parse error', error);
                }
            };

            es.onerror = () => {
                closeEventSource();

                if (disposed || !enabledRef.current) {
                    setConnectionState('paused');
                    return;
                }

                setConnectionState('reconnecting');
                clearReconnectTimer();
                reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
            };
        };

        connect();

        return () => {
            disposed = true;
            clearReconnectTimer();
            closeEventSource();
        };
    }, [isStreamEnabled, streamUrl]);

    const toggleStream = () => {
        setIsStreamEnabled((prev) => !prev);
    };

    return (
        <LiveStreamContext.Provider
            value={{
                liveEvents,
                isStreamEnabled,
                connectionState,
                lastEventAt,
                toggleStream,
                setIsStreamEnabled,
            }}
        >
            {children}
        </LiveStreamContext.Provider>
    );
};

export const useLiveStream = () => {
    const context = useContext(LiveStreamContext);
    if (!context) {
        throw new Error('useLiveStream must be used within LiveStreamProvider');
    }
    return context;
};
