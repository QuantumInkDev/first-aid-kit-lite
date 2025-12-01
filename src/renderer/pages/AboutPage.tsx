import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import companyLogo from '@assets/HBCBSNJ.png';
import appLogo from '@assets/fakl.png';

export const AboutPage: React.FC = () => {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <img src={companyLogo} alt="HBC BSN J" className="h-16 w-auto" />
            <img src={appLogo} alt="First Aid Kit Lite" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">First Aid Kit Lite</h1>
        </div>

        {/* Version Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Version Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Version:</span>
              <span className="font-medium text-gray-900">{__APP_VERSION__}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Build:</span>
              <span className="font-medium text-gray-900">{import.meta.env.DEV ? 'Development' : 'Production'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform:</span>
              <span className="font-medium text-gray-900">Windows</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            First Aid Kit Lite is a desktop application that provides a user-friendly interface
            for executing maintenance tools. Designed for IT professionals and
            system administrators, it simplifies routine system maintenance tasks with
            pre-configured, trusted tools.
          </p>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Features</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Execute pre-configured maintenance tools</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Real-time tool execution monitoring</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Execution history and logging</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Output viewer with copy functionality</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Category-based tool organization</span>
            </li>
          </ul>
        </div>

        {/* Technologies */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Powered By</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Electron</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">v39.2.2</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">React</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">v19.2.0</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">TypeScript</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">v5.9.3</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Vite</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">v7.2.2</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Tailwind CSS</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">v4.1.17</span>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} HBC BSN J. All rights reserved.</p>
        </div>
      </div>
    </AppLayout>
  );
};
