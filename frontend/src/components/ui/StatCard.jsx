import React from 'react';

const StatCard = ({ 
    title, value, subtitle, icon: Icon, badge,
    valueColor, iconStyle
}) => {
    return (
        <div 
            className="p-6 rounded-xl shadow-sm flex flex-col justify-between transition-all duration-300 relative overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:border-[#00AEEF]/30 border"
            style={{ 
                background: 'var(--surface-color)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderColor: 'var(--glass-border)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
            }}
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
                    <p className="text-3xl font-bold mt-2" style={{ color: valueColor || 'var(--text-primary)' }}>
                        {value}
                    </p>
                </div>
                <div className="flex items-center justify-center" style={iconStyle || { color: '#00AEEF', padding: '4px' }}>
                    <Icon size={20} />
                </div>
            </div>
            
            <div className="flex items-center gap-2 mt-auto">
                {badge ? (
                    badge
                ) : (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                )}
            </div>
        </div>
    );
};

export default StatCard;
