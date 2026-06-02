import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { sidebarNavItems, getCategorizedItems } from '../../config/sidebarConfig';
import useUserStore from '../../stores/userStore';

/**
 * @dev The main sidebar component for navigation.
 * It dynamically renders navigation links based on the user's role.
 * Features: Collapsible, categorized items, responsive design
 */
const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { userProfile, isLoggedIn, isAdmin } = useUserStore();

  const userRole = useMemo(() => {
    // Check localStorage for role (development/testing)
    const localRole = localStorage.getItem('role');
    if (localRole === 'admin') return 'admin';

    // Check userStore
    if (isAdmin) return 'admin';
    if (isLoggedIn && userProfile?.role === 'admin') return 'admin';
    if (isLoggedIn) return 'user';
    return 'public';
  }, [isLoggedIn, userProfile, isAdmin]);

  const accessibleLinks = useMemo(() => {
    return sidebarNavItems.filter(item => item.roles.includes(userRole));
  }, [userRole]);

  const categorizedItems = useMemo(() => {
    return getCategorizedItems(accessibleLinks);
  }, [accessibleLinks]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navLinkClasses = (isActive) => `
    flex items-center p-3 rounded-lg transition-all duration-200 relative
    ${isCollapsed ? 'justify-center' : ''}
    ${isActive
      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
    }
  `;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="fixed top-4 left-4 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded-lg shadow-lg md:hidden hover:shadow-xl transition-all duration-200"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle mobile menu"
      >
        <Menu size={24} />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          bg-gray-900 text-white min-h-screen p-4 flex flex-col 
          fixed top-0 left-0 z-40 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          border-r border-gray-800
        `}
      >
        {/* Header with Logo and Toggle */}
        <div className="flex items-center justify-between mb-8">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                BeZhas
              </span>
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-800 transition-colors duration-200"
            aria-label={isCollapsed ? "Expandir sidebar" : "Contraer sidebar"}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          {/* Mobile Close Button */}
          {isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-800"
              aria-label="Expandir sidebar"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {Object.entries(categorizedItems).map(([categoryKey, category]) => {
            if (category.items.length === 0) return null;

            return (
              <div key={categoryKey} className="mb-6">
                {/* Category Label */}
                {!isCollapsed && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
                    {category.label}
                  </h3>
                )}
                {isCollapsed && (
                  <div className="h-px bg-gray-800 my-2"></div>
                )}

                {/* Category Items */}
                <ul className="space-y-1">
                  {category.items.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) => navLinkClasses(isActive)}
                        onClick={(e) => {
                          // Solo cierra el sidebar en móvil, mantiene el scroll
                          if (window.innerWidth < 768) {
                            setSidebarOpen(false);
                          }
                        }}
                        preventScrollReset={true}
                        title={isCollapsed ? item.label : ''}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {!isCollapsed && (
                          <>
                            <span className="ml-3 font-medium">{item.label}</span>
                            {item.badge && (
                              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-blue-600 to-purple-600 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {isCollapsed && item.badge && (
                          <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-gray-800">
          {!isCollapsed && (
            <div className="text-xs text-gray-500 text-center">
              <p>© 2025 BeZhas</p>
              <p className="mt-1">v1.0.0</p>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}
    </>
  );
};

export default Sidebar;
