# First Aid Kit Lite - Session Status

## Current Status: Phase 10 - Production Ready

**Last Updated**: January 22, 2026 - file-restore Path Parameter Fix
**Current Sprint**: Production testing and deployment
**Overall Progress**: 100% feature complete, v1.0.0-beta.5 built and ready

## CONTINUE HERE

**Next Action**: Test file-restore protocol URL with path parameter
**Context**: Beta 5 with fix for path parameter being dropped when clicking restore links from backup emails
**Latest Build**: `release/First Aid Kit v3-1.0.0-beta.5-Setup.exe`

**Key Features in This Build**:
- System Dashboard with real-time metrics
- **NEW**: Password expiration display below greeting with color coding
- **NEW**: Clickable link to https://acmpm/HPM/ for password changes
- Favorites system with animated star UI
- 10 maintenance tools (including file-backup and file-restore)
- Protocol handlers (first-aid-kit://, fak://)
- Native Windows notifications

## Recent Progress

### Session January 22, 2026 - file-restore Path Parameter Fix

**Problem**: When clicking restore links from backup emails (`fak://run/file-restore?path=\\server\share\folder`), the Path parameter was being dropped, causing the folder browser dialog to appear instead of using the provided path.

**Root Cause**: Case mismatch between URL parameter (`path` lowercase) and script definition (`Path` capitalized). The backup script generated URLs with lowercase `path=` but the script definition expected `Path`.

**Fixes Applied**:

1. **Parameter Key Normalization** (`src/main/index.ts`):
   - Added normalization logic in `executeScriptFromProtocol()` that maps URL parameter keys to match script definition casing
   - URL `path=value` is now normalized to `Path=value` before execution

2. **Enhanced Debug Logging** (`src/main/services/powershell-executor.ts`):
   - Upgraded `getParameterCaseInsensitive()` to use `debugLog()` for DevTools visibility
   - Added special debug logging for `file-restore` script parameter lookups
   - All parameter comparison steps now logged for troubleshooting

3. **Backup Script Fix** (`scripts/file-backup.ps1`):
   - Changed `$script:RestoreProtocol` from `"fak://run/file-restore?path="` to `"fak://run/file-restore?Path="`
   - This ensures new backup emails use the correct casing

**Files Modified**:
- `src/main/index.ts` - Parameter normalization (lines 579-607)
- `src/main/services/powershell-executor.ts` - Enhanced logging
- `scripts/file-backup.ps1` - RestoreProtocol URL casing fix (line 98)

**Testing**: Build and package successful, `v1.0.0-beta.5` created

### Session January 20, 2026 - Password Expiration Feature
- **Password Expiration Display**:
  - Added `passwordExpiration` field to `UserInfo` interface in `system-info.ts`
  - Updated `CacheData` interface to cache password expiration data
  - Modified `getAdUserInfo()` to fetch `msDS-UserPasswordExpiryTimeComputed` from Active Directory
  - Added `calculatePasswordExpiration()` helper to compute days until expiration
  - Updated `UserInfo` type in `preload.ts` to match
  - Created `PasswordExpirationLine` component in `SystemInfoPanel.tsx`
  - Added `getOrdinalSuffix()` helper for date formatting (1st, 2nd, 3rd, etc.)
  - Added `getExpirationColor()` for color coding (red ≤3 days, yellow ≤7 days, gray otherwise)
  - Display format: "Your LAN Password Expires on Tuesday, January 2nd, 2026 @ 5:43PM (14 days)"
  - Clickable "(14 days)" link opens https://acmpm/HPM/ in default browser

- **Validation Schema Fix**:
  - Fixed `estimatedDuration` max in `ScriptDefinitionSchema` from 3,600,000ms (1hr) to 7,200,000ms (2hr)
  - This allows file-backup and file-restore scripts (6,000,000ms) to pass validation
  - Scripts were being silently rejected in production due to validation failure

- **Files Modified**:
  - `src/main/services/system-info.ts` - Password expiration query and caching
  - `src/preload/preload.ts` - Updated UserInfo type
  - `src/renderer/components/dashboard/SystemInfoPanel.tsx` - Password expiration display
  - `src/shared/validation/schemas.ts` - Increased estimatedDuration max

### Session December 30, 2025 - Favorites Feature
- **Favorites System**:
  - Added IPC handlers: `favorites:get`, `favorites:toggle` in `src/main/index.ts`
  - Added rate limits for favorites handlers in `src/main/services/ipc-validator.ts`
  - Updated preload script with `getFavorites` and `toggleFavorite` API methods
  - Created animated `FavoriteStar` component with sparkle effects in `ScriptCard.tsx`
  - Updated `ScriptList.tsx` to pass through favorites props
  - Updated `Scripts.tsx` to manage favorites state and handlers
  - Updated `App.tsx` Quick Actions to show favorites first with star icons
  - Favorites persist in database using existing settings table
- **Code Cleanup**:
  - Removed unused `spawn` import from `src/main/index.ts`
  - Removed unused `randomBytes` import from `src/main/services/powershell-executor.ts`

### Session December 30, 2025 - Beta 2 Release
- **Version Bump**: 1.0.0-beta.1 → 1.0.0-beta.2
- **System Dashboard Feature**:
  - Created `src/main/services/system-info.ts` - System info service with PowerShell queries
  - Created `src/renderer/hooks/useDashboard.tsx` - Dashboard data fetching hook
  - Created `src/renderer/components/dashboard/SystemInfoPanel.tsx` - Dashboard UI panel
  - Added IPC handlers: `system:get-dashboard-info`, `system:get-realtime-metrics`
  - Dashboard shows: User info, device/network, storage, RAM, CPU, BitLocker status, uptime
  - Auto-refresh: 60s for full info, 5s for realtime metrics
- **Dashboard Layout Changes**:
  - Changed from 3-column grid to horizontal stacked rows
  - Quick Actions now shows 8 tools in 2-column grid
  - Added "View All (count) Tools" button
- **Package Updates**:
  - Electron: 39.2.2 → 39.2.7
  - electron-vite: 4.0.1 → 5.0.0
  - Vite: 7.2.2 → 7.3.0
  - React: 19.2.0 → 19.2.3
  - And 20+ other packages updated to latest versions
- **Native Module Fix**:
  - Rebuilt better-sqlite3 for new Electron version using @electron/rebuild

### Session December 1, 2025 - Production Build Fixes
- **Fixed production app blank screen / routing issue**:
  - Changed `BrowserRouter` to `HashRouter` in `src/renderer/App.tsx`
  - BrowserRouter doesn't work with Electron's `file://` protocol in production
  - HashRouter uses hash-based URLs (`#/about`) that work correctly
  - All navigation now works in both development and production builds

- **Fixed production app not launching**:
  - Made `better-sqlite3` lazy-loaded to prevent native module crashes
  - Changed static `import Database from 'better-sqlite3'` to dynamic `require()` inside constructor
  - Database service now gracefully fails without crashing the app
  - Added `isDatabaseAvailable()` helper function
  - Updated all IPC handlers to check database availability before use
  - App now runs without persistence when database native module is incompatible

- **Previous fixes in this session**:
  - Fixed script-registry.ts to use `process.resourcesPath` for bundled scripts in production
  - Fixed powershell-executor.ts to use `app.getPath('userData')` for temp directory
  - Added `getAssetPath()` helper in index.ts for icons (works in dev and production)
  - Updated electron-builder.yml to include JSON metadata files and assets in extraResources

- **Production build verified**:
  - Portable version launches successfully
  - App window displays correctly
  - Scripts and assets load properly

### Session December 1, 2025 - Testing Framework & Production Build
- **Testing Framework Setup**:
  - Installed Vitest for unit/integration testing
  - Installed @testing-library/react and @testing-library/jest-dom
  - Installed Playwright for E2E testing
  - Created vitest.config.ts with jsdom environment and path aliases
  - Created tests/setup.ts with mocked window.electronAPI

- **Unit Tests** (tests/unit/):
  - validation.test.ts - 27 tests for Zod schemas
  - utils.test.ts - 7 tests for cn() utility

- **Integration Tests** (tests/integration/):
  - electron-api.test.ts - 20 tests for mocked Electron API
  - All IPC handlers covered

- **Test Results**: 54 tests passing, 100% pass rate

- **Production Build**:
  - Created electron-builder.yml with NSIS configuration
  - Created build/installer.nsh for protocol handler registration
  - Built production package: `First Aid Kit Lite-1.0.0-beta.1-Setup.exe`
  - Created win-unpacked portable version
  - Protocol handlers: first-aid-kit:// and fak://

- **Manual Testing Checklist**:
  - Created comprehensive 72-point checklist in tests/MANUAL_TESTING_CHECKLIST.md
  - Covers: startup, protocols, execution, navigation, settings, history, tray, window, notifications, performance, errors, accessibility, security

- **Dependency Cleanup** (from earlier in session):
  - Removed 9 unused packages: @fortawesome/*, @radix-ui/react-dialog, @tailwindcss/forms, @tailwindcss/typography, @types/jest, @types/uuid, ts-node

### Session December 1, 2025 - Dashboard & Protocol Improvements
- Dashboard Improvements:
  - Quick Actions panel now loads scripts dynamically from script registry
  - Development Status panel only shows in development mode
  - Usage Statistics panel added for production mode (placeholder until database connects)
- Protocol Handler Improvements:
  - Protocol requests now trigger script registry refresh for newly added scripts
  - Script IDs from JSON metadata (`id` field) now properly used for cleaner URLs
- Script Registry Enhancement:
  - Added `id` field to ScriptMetadata interface
  - Scripts can use simple IDs like `clear-temp` instead of path-based IDs

### Session December 1, 2025 - Protocol Integration Complete
- Protocol URL Parsing: `first-aid-kit://run/<script-id>?params` format
- Protocol-to-Renderer Communication via IPC
- Second-Instance Handling for existing app

### Session November 30, 2025 - Notification System & Button Styling
- Native Windows Notifications via Electron Notification API
- Button Styling: Blue Run buttons, Red Cancel buttons

### Session November 30, 2025 - UI Polish Pass
- Settings page removed, About page added
- Terminology changed to "tools"
- Menu bar hidden with keyboard shortcuts

### Session November 30, 2025 - Branding Pass
- Company Logo: HBCBSNJ.png
- App Logo: fakl.png
- Brand Colors: Primary #00468b, Secondary #88888d

## Key Decisions Made
- **Technology Stack**: Electron + React TypeScript + TailwindCSS + ShadCN UI
- **PowerShell Integration**: Use child_process.spawn() for better control
- **Security Approach**: Scripts are trusted (admin-crafted), run under user context
- **Notifications**: Native Windows toast notifications via Electron Notification API
- **Protocol Handlers**: Both first-aid-kit:// and fak:// protocols
- **Testing Framework**: Vitest + @testing-library/react + Playwright
- **Build System**: electron-vite + electron-builder with NSIS installer
- **Favorites Storage**: JSON array in SQLite settings table (no schema changes needed)
- **Dashboard Refresh**: 60s for full system info, 5s for realtime CPU/RAM metrics

## Implementation Status

### Phase 1: Project Foundation - COMPLETE
### Phase 2: Core Infrastructure - COMPLETE
### Phase 3: PowerShell Integration - COMPLETE
### Phase 4: User Interface Development - COMPLETE
### Phase 5: Script Implementation - COMPLETE
### Phase 5.5: Risk/Permission Cleanup - COMPLETE
### Phase 6: UI Polish Pass - COMPLETE
### Phase 7: Notification System - COMPLETE
### Phase 8: Protocol Integration - COMPLETE

### Phase 9: Testing & Quality Assurance - COMPLETE
- Testing framework: Vitest + Playwright
- Unit tests: 34 tests (validation + utils)
- Integration tests: 20 tests (Electron API)
- Total: 54 tests, 100% passing
- Production build: NSIS installer created
- Manual testing checklist: 72 points

### Phase 10: Packaging & Deployment - IN PROGRESS
- Production installer: `First Aid Kit Lite-1.0.0-beta.2-Setup.exe` built
- Portable version: `release/win-unpacked/` ready
- Code signing: Not configured (optional for internal distribution)
- Auto-update: Not configured

### Post-Phase Features Added
- **Favorites System** (December 30, 2025)
  - Animated star component with sparkle effects
  - Persistent storage in database
  - Quick Actions prioritizes favorites
- **System Dashboard** (December 30, 2025)
  - User info from Active Directory
  - Real-time CPU/RAM metrics
  - Drive space, network, BitLocker status

## Production Artifacts

| File | Description | Size |
|------|-------------|------|
| `release/First Aid Kit Lite-1.0.0-beta.2-Setup.exe` | NSIS Installer | ~130MB |
| `release/win-unpacked/` | Portable version | ~335MB |
| `release/*.blockmap` | Delta update files | N/A |

## Testing Commands

```bash
# Run all unit/integration tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests (Playwright)
pnpm test:e2e

# Build production package
pnpm package
```

## Protocol Testing

```bash
# Test first-aid-kit:// protocol
start first-aid-kit://run/clear-temp

# Test fak:// protocol (short)
start fak://run/flush-dns
```

## Next Session Priorities

1. **Testing**: Run production build through manual testing checklist
2. **OPTIONAL**: Code signing for enterprise deployment
3. **OPTIONAL**: Auto-update configuration via electron-updater
4. **OPTIONAL**: Create end-user documentation / quick start guide

## Important Notes

### Build Configuration
- electron-builder.yml: NSIS installer with protocol registration
- npmRebuild: false (skips native module rebuild, uses prebuilt binaries)
- Protocol handlers registered during NSIS install via installer.nsh

### Test Configuration
- vitest.config.ts: jsdom environment, path aliases for @, @main, @shared
- tests/setup.ts: Mock window.electronAPI for renderer tests
- playwright.config.ts: E2E test configuration

### Development Environment
- Working Directory: `P:\Projects-Not-On-Cloud\FAKL`
- Platform: Windows 11
- Package Manager: pnpm
- TypeScript: Zero errors
- Test Coverage: 54 tests passing

---

**REMEMBER**: Update this file at the end of next session with progress made and move the CONTINUE HERE marker to the new stopping point.
