import React, { useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SettingsTab = 'general' | 'security' | 'scripts' | 'about';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    resetSettings();
    setShowResetConfirm(false);
  };

  const tabs = [
    { id: 'general' as SettingsTab, label: 'General', icon: '⚙️' },
    { id: 'security' as SettingsTab, label: 'Security', icon: '🔒' },
    { id: 'scripts' as SettingsTab, label: 'Script Management', icon: '📜' },
    { id: 'about' as SettingsTab, label: 'About', icon: 'ℹ' },
  ];

  const handleTabClick = (e: React.MouseEvent<HTMLButtonElement>, tabId: SettingsTab) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    setActiveTab(tabId);
    return false;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-2 text-sm text-gray-600">
              Configure First Aid Kit Lite to match your preferences and security requirements.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowResetConfirm(true)}
            className="text-sm"
          >
            Reset to Defaults
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={(e) => handleTabClick(e, tab.id)}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  'group inline-flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                <span className="text-lg pointer-events-none select-none">{tab.icon}</span>
                <span className="pointer-events-none select-none">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'scripts' && <ScriptManagementSettings />}
          {activeTab === 'about' && <AboutSection />}
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset Settings</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to reset all settings to their default values? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleReset} className="bg-red-600 hover:bg-red-700">
                    Reset Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// General Settings Section
const GeneralSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how First Aid Kit Lite looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Theme</label>
            <div className="flex gap-3">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateSettings({ theme })}
                  className={cn(
                    'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors capitalize',
                    settings.theme === theme
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Enable Notifications"
            description="Show Windows notifications for script execution results"
            checked={settings.enableNotifications}
            onChange={(checked) => updateSettings({ enableNotifications: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application Behavior</CardTitle>
          <CardDescription>Control how the application behaves</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Enable Auto-Update"
            description="Automatically download and install updates"
            checked={settings.enableAutoUpdate}
            onChange={(checked) => updateSettings({ enableAutoUpdate: checked })}
          />
          <ToggleSetting
            label="Minimize to System Tray"
            description="Keep the app running in the background when closed"
            checked={settings.minimizeToTray}
            onChange={(checked) => updateSettings({ minimizeToTray: checked })}
          />
          <ToggleSetting
            label="Start Minimized"
            description="Launch the application minimized to system tray"
            checked={settings.startMinimized}
            onChange={(checked) => updateSettings({ startMinimized: checked })}
          />
        </CardContent>
      </Card>
    </div>
  );
};

// Security Settings Section
const SecuritySettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Execution Policies</CardTitle>
          <CardDescription>Configure script execution security policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Require Confirmation"
            description="Always show confirmation dialog before executing scripts"
            checked={settings.requireConfirmation}
            onChange={(checked) => updateSettings({ requireConfirmation: checked })}
          />
          <ToggleSetting
            label="Show Risk Warnings"
            description="Display risk level warnings in confirmation dialogs"
            checked={settings.showRiskWarnings}
            onChange={(checked) => updateSettings({ showRiskWarnings: checked })}
          />
          <ToggleSetting
            label="Block High-Risk Scripts"
            description="Prevent execution of scripts marked as high risk"
            checked={settings.blockHighRiskScripts}
            onChange={(checked) => updateSettings({ blockHighRiskScripts: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit & Logging</CardTitle>
          <CardDescription>Control audit trail and logging behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Enable Audit Logging"
            description="Log all script executions for security auditing"
            checked={settings.enableAuditLogging}
            onChange={(checked) => updateSettings({ enableAuditLogging: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution Timeout</CardTitle>
          <CardDescription>Maximum time allowed for script execution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
              <span>Timeout (seconds)</span>
              <span className="text-blue-600 font-semibold">{settings.executionTimeout}s</span>
            </label>
            <input
              type="range"
              min="30"
              max="600"
              step="30"
              value={settings.executionTimeout}
              onChange={(e) => updateSettings({ executionTimeout: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>30s</span>
              <span>5m</span>
              <span>10m</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Script Management Settings Section
const ScriptManagementSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Script Discovery</CardTitle>
          <CardDescription>Configure how scripts are discovered and validated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Auto-Discover Scripts"
            description="Automatically scan for new PowerShell scripts on startup"
            checked={settings.autoDiscoverScripts}
            onChange={(checked) => updateSettings({ autoDiscoverScripts: checked })}
          />
          <ToggleSetting
            label="Validate Scripts on Startup"
            description="Run security validation on all scripts during application startup"
            checked={settings.validateScriptsOnStartup}
            onChange={(checked) => updateSettings({ validateScriptsOnStartup: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution Limits</CardTitle>
          <CardDescription>Control concurrent script execution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
              <span>Max Concurrent Executions</span>
              <span className="text-blue-600 font-semibold">{settings.maxConcurrentExecutions}</span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={settings.maxConcurrentExecutions}
              onChange={(e) => updateSettings({ maxConcurrentExecutions: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>3</span>
              <span>5</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Script Output</CardTitle>
          <CardDescription>Control script execution output display</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Show Script Output"
            description="Display PowerShell output from script execution"
            checked={settings.showScriptOutput}
            onChange={(checked) => updateSettings({ showScriptOutput: checked })}
          />
        </CardContent>
      </Card>
    </div>
  );
};

// About Section
const AboutSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <CardTitle className="text-2xl">First Aid Kit Lite</CardTitle>
              <CardDescription>Version 0.1.0-alpha</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              A secure desktop application for executing PowerShell maintenance scripts through
              browser-triggered protocol handlers.
            </p>
            <p>
              Built with Electron, React, and TypeScript for a modern, secure, and user-friendly experience.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Application" value="First Aid Kit Lite v0.1.0-alpha" />
          <InfoRow label="Framework" value="Electron + React + TypeScript" />
          <InfoRow label="Platform" value={navigator.platform} />
          <InfoRow label="User Agent" value={navigator.userAgent.split(' ').slice(-2).join(' ')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <LinkButton label="Documentation" href="#" />
          <LinkButton label="GitHub Repository" href="https://github.com/QuantumInkDev/first-aid-kit-lite" />
          <LinkButton label="Report an Issue" href="https://github.com/QuantumInkDev/first-aid-kit-lite/issues" />
          <LinkButton label="View License" href="#" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>© 2025 First Aid Kit Lite. All rights reserved.</p>
          <p className="text-xs text-gray-500">
            This software is provided "as is" without warranty of any kind. Use at your own risk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper Components
interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({ label, description, checked, onChange }) => {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700 block">{label}</label>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
          checked ? 'bg-blue-600' : 'bg-gray-200'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
};

interface LinkButtonProps {
  label: string;
  href: string;
}

const LinkButton: React.FC<LinkButtonProps> = ({ label, href }) => {
  const isPlaceholder = !href || href === '#';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPlaceholder) {
      // Placeholder links - show coming soon message
      console.log(`${label} is coming soon`);
      return;
    }

    if (href && href.startsWith('http')) {
      // Open external links in default browser
      try {
        const shell = require('electron').shell;
        shell.openExternal(href);
      } catch (error) {
        // Fallback if shell is not available
        console.log('Opening external link:', href);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left rounded-lg transition-colors ${
        isPlaceholder
          ? 'text-gray-400 cursor-not-allowed'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
      disabled={isPlaceholder}
    >
      <span>{label}</span>
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </button>
  );
};
