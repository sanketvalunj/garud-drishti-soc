import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isOnboarded, setIsOnboarded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        // Restore session from localStorage on mount
        const auth = localStorage.getItem('auth');
        const onboarded = localStorage.getItem('onboarded');
        const storedUser = localStorage.getItem('user');

        if (auth === 'true') {
            setIsAuthenticated(true);
            if (storedUser) setUser(JSON.parse(storedUser));
        }
        if (onboarded === 'true') {
            setIsOnboarded(true);
        }
        setLoading(false);
    }, []);

    const login = (username, password) => {
        if (username === 'testuser' && password === 'password123') {
            const userData = { username, role: 'Analyst' };
            setIsAuthenticated(true);
            setUser(userData);
            localStorage.setItem('auth', 'true');
            localStorage.setItem('user', JSON.stringify(userData));
            return true;
        }
        return false;
    };

    const completeOnboarding = () => {
        setIsOnboarded(true);
        localStorage.setItem('onboarded', 'true');
    };

    const logout = () => {
        setIsAuthenticated(false);
        setIsOnboarded(false);
        setUser(null);
        localStorage.removeItem('auth');
        localStorage.removeItem('onboarded');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isOnboarded,
            user,
            loading,
            login,
            logout,
            completeOnboarding,
            // Legacy compat
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
