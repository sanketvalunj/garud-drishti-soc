import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = "blue", delay = 0, onClick, className }) => {
    const colors = {
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        red: "bg-red-500/10 text-red-400 border-red-500/20",
        green: "bg-green-500/10 text-green-400 border-green-500/20",
        violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
        amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1 }}
            onClick={onClick}
            className={clsx(
                "glass-card p-5 relative overflow-hidden group hover:border-white/30 transition-all duration-300",
                onClick && "cursor-pointer",
                className
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-slate-400">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-1">{value}</h3>
                </div>
                <div className={clsx("p-3 rounded-xl", colors[color])}>
                    <Icon size={24} />
                </div>
            </div>

            {trend && (
                <div className="flex items-center gap-2 text-sm">
                    <span className={clsx(
                        "flex items-center font-medium",
                        trend === 'up' ? "text-green-500" : "text-red-500"
                    )}>
                        {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {trendValue}
                    </span>
                    <span className="text-slate-500">vs yesterday</span>
                </div>
            )}

            {/* Background decoration */}
            <div className={clsx(
                "absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
                color === 'blue' && "bg-blue-500",
                color === 'red' && "bg-red-500",
                color === 'green' && "bg-green-500",
                color === 'violet' && "bg-violet-500",
                color === 'amber' && "bg-amber-500",
            )} />
        </motion.div>
    );
};

export default StatCard;
