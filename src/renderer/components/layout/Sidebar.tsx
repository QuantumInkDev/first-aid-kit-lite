import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    name: 'Tools',
    path: '/scripts',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    badge: '7',
  },
  {
    name: 'Run History',
    path: '/logs',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <div className="flex items-center space-x-3">
                <span className={cn(isActive ? 'text-blue-700' : 'text-gray-500')}>
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-200 text-gray-700'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* About Link at Bottom */}
      <div className="px-4 py-4 border-t border-gray-200">
        <Link
          to="/about"
          className={cn(
            'flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors',
            location.pathname === '/about'
              ? 'bg-primary/10 text-primary'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <svg
            className={cn('w-5 h-5 mr-3', location.pathname === '/about' ? 'text-primary' : 'text-gray-500')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>About</span>
        </Link>
      </div>
    </aside>
  );
};
