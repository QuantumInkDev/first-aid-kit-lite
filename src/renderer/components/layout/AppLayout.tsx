import React from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  // Key on pathname to trigger animation on route change
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div
            key={location.pathname}
            className="max-w-7xl mx-auto px-6 py-8 animate-fade-in"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
