# First Aid Kit Lite - Technical Architecture

## Overview

This document outlines the technical architecture for First Aid Kit Lite, an Electron-based desktop application that enables secure browser-triggered execution of PowerShell maintenance scripts.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                               Browser                                │
│                        (Any modern browser)                         │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Protocol URLs
                          │ first-aid-kit://action
                          │ fak://action
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Windows Registry                              │
│                    Protocol Handler Registration                    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ OS Protocol Handler
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                            │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │ Protocol Handler │ │ Security Module  │ │   IPC Manager    │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │ Script Manager   │ │ Logger Service   │ │ Settings Manager │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │PowerShell Engine │ │ Database Service │ │Notification Mgr  │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Secure IPC (Context Bridge)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Electron Renderer Process                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      React Application                      │    │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │    │
│  │  │  Confirmation   │ │  Settings UI    │ │   Log Viewer    │ │    │
│  │  │     Dialog      │ │                 │ │                 │ │    │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ │    │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │    │
│  │  │Script Execution │ │   Dashboard     │ │  Notification   │ │    │
│  │  │   Progress      │ │                 │ │     Panel       │ │    │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Windows 11 Toast Service                         │
│                   (Native OS Notifications)                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Process Architecture

### Main Process (Node.js Backend)

The main process handles all system-level operations and security-sensitive tasks:

#### Core Modules

1. **Protocol Handler Module**
   - Registers custom protocols with Windows
   - Parses and validates incoming protocol URLs
   - Routes requests to appropriate handlers

2. **Security Module**
   - Input validation and sanitization
   - Permission checking
   - Rate limiting and abuse prevention
   - Code signing verification

3. **PowerShell Engine**
   - Script execution with sandboxing
   - Resource monitoring and limits
   - Error handling and recovery
   - Output capture and logging

4. **IPC Manager**
   - Secure communication bridge
   - Message validation and serialization
   - Channel management

5. **Services Layer**
   - Logger Service (Winston)
   - Database Service (SQLite)
   - Settings Manager
   - Notification Manager

### Renderer Process (React Frontend)

The renderer process provides the user interface with strict security isolation:

#### Component Architecture

```typescript
App.tsx
├── AppProvider (Context)
│   ├── SettingsProvider
│   ├── NotificationProvider
│   └── SecurityProvider
├── Router
│   ├── Dashboard
│   │   ├── QuickActions
│   │   └── SystemStatus
│   ├── Scripts
│   │   ├── ScriptLibrary
│   │   └── ExecutionHistory
│   ├── Settings
│   │   ├── GeneralSettings
│   │   ├── SecuritySettings
│   │   └── LoggingSettings
│   └── Logs
│       ├── LogViewer
│       └── LogExport
└── GlobalComponents
    ├── ConfirmationDialog
    ├── ExecutionProgress
    └── NotificationToast
```

## Folder Structure

```
src/
├── main/                           # Main process (Node.js/Electron)
│   ├── core/
│   │   ├── app.ts                 # Main application setup
│   │   ├── window-manager.ts      # Window creation and management
│   │   ├── protocol-handler.ts    # Protocol registration
│   │   └── security.ts            # Security policies
│   ├── ipc/
│   │   ├── channels.ts            # IPC channel definitions
│   │   ├── handlers.ts            # IPC message handlers
│   │   └── validators.ts          # Input validation
│   ├── powershell/
│   │   ├── executor.ts            # PowerShell execution engine
│   │   ├── script-registry.ts     # Script management
│   │   ├── sandbox.ts             # Script sandboxing
│   │   └── scripts/               # Script definitions
│   ├── services/
│   │   ├── logger.ts              # Winston logging
│   │   ├── database.ts            # SQLite operations
│   │   ├── settings.ts            # Settings management
│   │   └── notifications.ts       # Toast notifications
│   └── utils/
│       ├── crypto.ts              # Encryption utilities
│       └── validation.ts          # Validation helpers
├── renderer/                      # Renderer process (React)
│   ├── components/
│   │   ├── ui/                    # ShadCN UI components
│   │   ├── features/              # Feature-specific components
│   │   └── layout/                # Layout components
│   ├── hooks/                     # Custom React hooks
│   ├── contexts/                  # React contexts
│   ├── services/                  # Frontend services
│   └── utils/                     # Frontend utilities
├── shared/                        # Shared between processes
│   ├── types/                     # TypeScript definitions
│   ├── constants/                 # Application constants
│   └── utils/                     # Common utilities
└── preload/
    └── preload.ts                 # Secure IPC bridge
```

## Security Architecture

### Process Isolation

```
┌─────────────────────────────────────────────────┐
│                Main Process                     │
│  ┌─────────────────────────────────────────┐    │
│  │        Privileged Operations            │    │
│  │  • PowerShell execution                 │    │
│  │  • File system access                   │    │
│  │  • Registry modifications               │    │
│  │  • Network operations                   │    │
│  │  • System notifications                 │    │
│  └─────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────┘
                  │ Secure IPC Bridge
                  │ (Context Bridge)
                  ▼
┌─────────────────────────────────────────────────┐
│               Renderer Process                  │
│  ┌─────────────────────────────────────────┐    │
│  │           Sandboxed UI                  │    │
│  │  • No direct system access             │    │
│  │  • No Node.js APIs                     │    │
│  │  • Limited to exposed bridge APIs      │    │
│  │  • Content Security Policy enforced    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Security Layers

1. **Input Validation**
   - Protocol URL sanitization
   - Parameter validation with schemas
   - XSS prevention in UI
   - SQL injection prevention

2. **Authentication & Authorization**
   - User confirmation for all script executions
   - Permission-based script access
   - Rate limiting per user/session
   - Audit logging for all actions

3. **Script Sandboxing**
   - PowerShell execution in restricted runspace
   - Resource limits (CPU, memory, time)
   - File system access restrictions
   - Network access controls

4. **Data Protection**
   - Logs encrypted at rest
   - Secure storage of settings
   - No sensitive data in renderer process
   - Automatic log rotation and cleanup

## Data Architecture

### Database Schema (SQLite)

```sql
-- Execution logs table
CREATE TABLE execution_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    script_id TEXT NOT NULL,
    user_context TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'running', 'success', 'error', 'cancelled')),
    duration_ms INTEGER,
    exit_code INTEGER,
    output TEXT,
    error_message TEXT,
    parameters JSON,
    FOREIGN KEY (script_id) REFERENCES scripts(id)
);

-- Script definitions table
CREATE TABLE scripts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    script_path TEXT NOT NULL,
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high')),
    timeout_ms INTEGER DEFAULT 30000,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Application settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    data_type TEXT CHECK(data_type IN ('string', 'number', 'boolean', 'json')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System metrics table
CREATE TABLE metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);
```

### Configuration Management

```typescript
interface AppConfig {
  security: {
    maxExecutionsPerHour: number;
    scriptTimeoutMs: number;
    enableLogging: boolean;
    logRetentionDays: number;
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    confirmationRequired: boolean;
    showNotifications: boolean;
    notificationDuration: number;
  };
  scripts: {
    scriptDirectory: string;
    allowCustomScripts: boolean;
    requireSignedScripts: boolean;
  };
}
```

## Communication Protocols

### IPC Channel Definitions

```typescript
// Main to Renderer channels
enum MainToRenderer {
  SCRIPT_EXECUTION_STARTED = 'script:execution:started',
  SCRIPT_EXECUTION_PROGRESS = 'script:execution:progress',
  SCRIPT_EXECUTION_COMPLETED = 'script:execution:completed',
  SCRIPT_EXECUTION_ERROR = 'script:execution:error',
  SETTINGS_UPDATED = 'settings:updated',
  LOG_ENTRY_ADDED = 'log:entry:added'
}

// Renderer to Main channels
enum RendererToMain {
  EXECUTE_SCRIPT = 'script:execute',
  GET_SCRIPT_LIST = 'script:list',
  GET_EXECUTION_LOGS = 'log:get',
  UPDATE_SETTINGS = 'settings:update',
  GET_SYSTEM_INFO = 'system:info'
}
```

### Protocol URL Structure

```
first-aid-kit://[action]?[parameters]
fak://[action]?[parameters]

Examples:
- first-aid-kit://clear-temp
- first-aid-kit://flush-dns
- fak://restart-explorer?force=true
- first-aid-kit://custom-script?name=cleanup&param1=value1
```

## Performance Considerations

### Memory Management
- Lazy loading of non-critical components
- Efficient data structures for log storage
- Regular garbage collection in PowerShell sessions
- Memory leak detection and prevention

### Startup Performance
- Main process initialization < 1 second
- Renderer process ready < 2 seconds
- Protocol registration on first run only
- Deferred loading of heavy dependencies

### Execution Performance
- Script execution overhead < 100ms
- Concurrent script execution limits
- Resource monitoring and cleanup
- Efficient IPC message batching

## Monitoring and Observability

### Logging Strategy
- Structured logging with Winston
- Log levels: ERROR, WARN, INFO, DEBUG
- Automatic log rotation (daily/size-based)
- Centralized error aggregation

### Metrics Collection
- Script execution metrics
- Performance counters
- Error rates and types
- User interaction patterns

### Health Checks
- Main process health monitoring
- Database connectivity checks
- PowerShell availability verification
- Protocol handler registration status

## Deployment Architecture

### Packaging Strategy
- Electron Forge for packaging
- Code signing with EV certificate
- Auto-update mechanism with Electron updater
- MSI installer for Windows

### Distribution
- GitHub Releases for binaries
- Automatic update notifications
- Rollback capability for failed updates
- Silent installation for enterprise environments

---

This architecture provides a secure, scalable foundation for First Aid Kit Lite while maintaining separation of concerns and following Electron best practices.