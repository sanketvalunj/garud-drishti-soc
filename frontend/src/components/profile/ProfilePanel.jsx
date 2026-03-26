import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Shield, Activity, Clock, LogOut } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import { useAuth } from '../../context/AuthContext';
import Tier1Stats from './Tier1Stats';
import Tier2Stats from './Tier2Stats';
import Tier3Stats from './Tier3Stats';

const ProfilePanel = ({ isOpen, onClose }) => {
  const { role, roleLabel, isTier1, isTier2, isTier3 } = useRole();
  const { user, logout } = useAuth();

  const activityLog = [
    { action: 'Escalated incident', target: 'INC-829', time: '12m ago' },
    { action: 'Ran playbook', target: 'Phishing_v4', time: '1h ago' },
    { action: 'Investigated alert', target: 'Unauthorized_Login', time: '3h ago' }
  ];

  const getRoleColor = () => {
    if (isTier1) return '#3B82F6';
    if (isTier2) return '#F59E0B';
    if (isTier3) return '#EF4444';
    return '#10B981';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '400px',
              maxWidth: '100%',
              background: 'linear-gradient(180deg, #020B18 0%, #001A2C 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: '24px', 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Shield size={20} color={getRoleColor()} />
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>Analyst Profile</span>
              </div>
              <button 
                onClick={onClose}
                style={{ 
                  background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'rgba(255,255,255,0.5)', cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="custom-scrollbar">
              {/* User Info Card */}
              <div style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '32px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
                  background: getRoleColor(), opacity: 0.1, borderRadius: '50%', filter: 'blur(30px)'
                }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    width: '56px', height: '56px', borderRadius: '14px',
                    background: `linear-gradient(135deg, ${getRoleColor()} 0%, #000 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', fontWeight: 700, color: 'white'
                  }}>
                    {user?.avatar || 'U'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>{user?.name || 'User'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                      <span style={{ fontSize: '12px', color: getRoleColor(), fontWeight: 600 }}>{roleLabel}</span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>· Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Stats Section */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Activity size={14} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Performance Metrics</span>
                </div>
                {isTier1 && <Tier1Stats />}
                {isTier2 && <Tier2Stats />}
                {isTier3 && <Tier3Stats />}
              </div>

              {/* Activity Log */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Clock size={14} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Recent Activity</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activityLog.map((log, idx) => (
                    <div key={idx} style={{ 
                      padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)',
                      background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', color: 'white', fontWeight: 500 }}>{log.action}</span>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{log.target}</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => { logout(); onClose(); }}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)',
                  background: 'rgba(239,68,68,0.05)', color: '#F87171', fontSize: '11px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700
                }}
              >
                <LogOut size={16} />
                TERMINATE SESSION
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfilePanel;
