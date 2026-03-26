import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const RoleContext = createContext();

export const RoleProvider = ({ children }) => {
  const { user } = useAuth();

  const roleData = useMemo(() => {
    const role = user?.role || 'tier1';
    
    return {
      role,
      isTier1: role === 'tier1',
      isTier2: role === 'tier2',
      isTier3: role === 'tier3',
      roleLabel: user?.roleLabel || 'Analyst',
      permissions: user?.permissions || []
    };
  }, [user]);

  return (
    <RoleContext.Provider value={roleData}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
