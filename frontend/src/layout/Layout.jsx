import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const Layout = () => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex relative overflow-hidden font-sans selection:bg-blue-500/30">

            {/* Global Background Ambience */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[150px]"></div>
                <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-violet-900/10 rounded-full blur-[150px]"></div>
            </div>

            {/* Sidebar Area */}
            <div className="w-72 relative z-50 hidden lg:block">
                <Sidebar />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 p-4 lg:p-6 lg:ml-4 overflow-y-auto h-screen custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
