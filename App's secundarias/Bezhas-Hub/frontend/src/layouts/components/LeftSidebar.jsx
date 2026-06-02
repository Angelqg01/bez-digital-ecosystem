import React from 'react';
import { NavLink } from 'react-router-dom';
import { sidebarNavItems } from '../../config/sidebarConfig';

export default function LeftSidebar() {
    return (
        <nav className="sticky top-24 space-y-1">
            {sidebarNavItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                >
                    <span className="text-gray-400">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );
}
