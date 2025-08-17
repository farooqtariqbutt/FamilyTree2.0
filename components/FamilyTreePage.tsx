
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const SubNavItem = ({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) => {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) => `whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${isActive
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
        >
            {children}
        </NavLink>
    );
};

const FamilyTreePage = () => {
    return (
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl flex flex-col flex-1">
            <div className="p-6 pb-0 flex-shrink-0">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Family Tree</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Visualize your family in an interactive tree or a pedigree chart.</p>
                </div>
                <div className="mt-4 border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <SubNavItem to="/tree" end={true}>Family Tree View</SubNavItem>
                        <SubNavItem to="/tree/who-am-i">Who Am I</SubNavItem>
                        <SubNavItem to="/tree/generation">Generation View</SubNavItem>
                    </nav>
                </div>
            </div>
            <div className="flex-grow flex flex-col">
                <Outlet />
            </div>
        </div>
    );
};

export default FamilyTreePage;
