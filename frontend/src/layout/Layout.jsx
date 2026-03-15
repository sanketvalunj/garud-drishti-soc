import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DashboardBackground from '../components/background/DashboardBackground';

const Layout = () => {
    return (
        <div className="min-h-screen flex relative overflow-hidden font-sans selection:bg-blue-500/30">
            {/* Global WebGL Background Engine */}
            <DashboardBackground />

            {/* Sidebar Area */}
            <div className="w-72 relative z-50 hidden lg:block">
                <Sidebar />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 p-4 lg:p-6 lg:ml-4 overflow-y-auto h-screen custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6 pb-20">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
