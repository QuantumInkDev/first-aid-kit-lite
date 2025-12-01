# First Aid Kit Lite - Manual Testing Checklist

**Version**: 1.0.0-beta.1
**Last Updated**: December 1, 2025
**Tested On**: Windows 11

---

## Pre-Testing Setup

- [ ] Close all instances of First Aid Kit Lite
- [ ] Verify packaged app exists at `release/win-unpacked/First Aid Kit Lite.exe`
- [ ] Verify protocol handlers are registered (run `reg query "HKEY_CLASSES_ROOT\first-aid-kit"`)
- [ ] Clear any previous execution logs

---

## 1. Application Startup

### 1.1 Normal Launch
- [ ] Launch from `release/win-unpacked/First Aid Kit Lite.exe`
- [ ] Verify application window appears within 3 seconds
- [ ] Verify splash/loading screen (if any) transitions smoothly
- [ ] Verify main dashboard loads without errors
- [ ] Verify system tray icon appears

### 1.2 Single Instance
- [ ] With app running, try launching another instance
- [ ] Verify second instance does not open
- [ ] Verify first instance is brought to foreground

---

## 2. Protocol Handler Testing

### 2.1 first-aid-kit:// Protocol
- [ ] Run: `start first-aid-kit://run/clear-temp`
- [ ] Verify app launches (or focuses if running)
- [ ] Verify confirmation dialog appears with script details
- [ ] Verify script name "Clear Temp Files" is displayed
- [ ] Verify risk level indicator is shown (low/medium/high)
- [ ] Verify estimated duration is displayed

### 2.2 fak:// Protocol (Short)
- [ ] Run: `start fak://run/flush-dns`
- [ ] Verify app launches and shows confirmation dialog
- [ ] Verify "Flush DNS Cache" script is recognized

### 2.3 Invalid Protocol URLs
- [ ] Run: `start first-aid-kit://run/nonexistent-script`
- [ ] Verify error message is shown
- [ ] Verify app does not crash
- [ ] Run: `start first-aid-kit://invalid/path`
- [ ] Verify graceful error handling

### 2.4 Browser Integration
- [ ] Open browser and navigate to a page with protocol link
- [ ] Test `<a href="first-aid-kit://run/clear-temp">` link
- [ ] Verify browser shows protocol handler prompt
- [ ] Verify app launches when allowed

---

## 3. Script Execution

### 3.1 Script Selection (UI)
- [ ] Navigate to Scripts page
- [ ] Verify all available scripts are listed
- [ ] Verify script categories are displayed
- [ ] Verify risk levels are color-coded
- [ ] Click on a script to view details
- [ ] Verify script description is shown

### 3.2 Script Execution Flow
- [ ] Select "Clear Temp Files" script
- [ ] Click "Run" button
- [ ] Verify confirmation dialog appears
- [ ] Click "Confirm" to execute
- [ ] Verify progress indicator shows
- [ ] Verify output/logs are displayed
- [ ] Verify success notification appears

### 3.3 Script Cancellation
- [ ] Start a long-running script
- [ ] Click "Cancel" button
- [ ] Verify script execution stops
- [ ] Verify "Cancelled" status is shown

### 3.4 Error Handling
- [ ] Attempt to run a script that will fail
- [ ] Verify error message is displayed
- [ ] Verify error is logged
- [ ] Verify app remains stable

---

## 4. Navigation

### 4.1 Page Navigation
- [ ] Click on Dashboard link - verify navigation
- [ ] Click on Scripts link - verify navigation
- [ ] Click on History link - verify navigation
- [ ] Click on Settings link - verify navigation
- [ ] Verify smooth page transitions
- [ ] Verify no flickering or jarring transitions

### 4.2 Back/Forward
- [ ] Navigate through multiple pages
- [ ] Verify navigation history works correctly

---

## 5. Settings

### 5.1 Theme Settings
- [ ] Toggle between Light/Dark/System themes
- [ ] Verify theme changes apply immediately
- [ ] Verify theme persists after app restart

### 5.2 Notification Settings
- [ ] Change notification level (All/Errors Only/None)
- [ ] Verify setting persists
- [ ] Verify notifications respect the setting

### 5.3 Execution Settings
- [ ] Toggle "Require confirmation before execution"
- [ ] Verify behavior changes accordingly
- [ ] Change max concurrent executions
- [ ] Change script timeout value

---

## 6. Execution History/Logs

### 6.1 History Display
- [ ] Navigate to History page
- [ ] Verify past executions are listed
- [ ] Verify execution details (timestamp, duration, status)
- [ ] Verify failed executions show error info

### 6.2 Log Export
- [ ] Click "Export Logs" button
- [ ] Select JSON format - verify export
- [ ] Select CSV format - verify export
- [ ] Verify exported file contains correct data

### 6.3 Log Filtering
- [ ] Filter by status (success/failed)
- [ ] Filter by date range
- [ ] Filter by script name
- [ ] Verify filters work correctly

---

## 7. System Tray

### 7.1 Tray Icon
- [ ] Verify tray icon is visible
- [ ] Right-click tray icon - verify context menu appears
- [ ] Click "Show" - verify window appears
- [ ] Click "Quit" - verify app closes

### 7.2 Minimize to Tray
- [ ] Minimize application
- [ ] Verify app goes to system tray (if enabled)
- [ ] Click tray icon to restore

---

## 8. Window Management

### 8.1 Window Operations
- [ ] Minimize window - verify minimizes
- [ ] Maximize window - verify maximizes
- [ ] Restore window - verify restores
- [ ] Resize window - verify responsive layout
- [ ] Drag window - verify can be repositioned

### 8.2 Window State Persistence
- [ ] Resize window to custom size
- [ ] Close and reopen app
- [ ] Verify window size is remembered
- [ ] Verify window position is remembered

---

## 9. Notifications

### 9.1 Toast Notifications
- [ ] Execute a script - verify success notification
- [ ] Trigger an error - verify error notification
- [ ] Verify notifications are dismissible
- [ ] Verify notification duration is appropriate

### 9.2 Windows Notifications
- [ ] Verify Windows toast notifications work
- [ ] Verify clicking notification focuses app

---

## 10. Performance

### 10.1 Startup Performance
- [ ] Cold start time < 3 seconds
- [ ] Warm start time < 1 second

### 10.2 Memory Usage
- [ ] Idle memory usage < 200MB
- [ ] Memory during script execution < 350MB
- [ ] No memory leaks after multiple script executions

### 10.3 Responsiveness
- [ ] UI remains responsive during script execution
- [ ] Navigation is instant
- [ ] No UI freezing

---

## 11. Error Scenarios

### 11.1 Network Errors
- [ ] Test with network disconnected
- [ ] Verify appropriate error messages

### 11.2 Permission Errors
- [ ] Attempt to run script requiring elevation
- [ ] Verify UAC prompt appears (if needed)
- [ ] Verify permission denied error is handled

### 11.3 File System Errors
- [ ] Test with restricted folder access
- [ ] Verify error is properly reported

---

## 12. Accessibility

### 12.1 Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Verify logical tab order
- [ ] Verify Enter activates buttons
- [ ] Verify Escape closes dialogs

### 12.2 Screen Reader
- [ ] Verify all elements have accessible labels
- [ ] Verify dialog announcements
- [ ] Verify status updates are announced

---

## 13. Security

### 13.1 Input Validation
- [ ] Attempt script injection in parameters
- [ ] Verify inputs are sanitized
- [ ] Verify no XSS vulnerabilities

### 13.2 Protocol Security
- [ ] Verify only valid scripts can be executed
- [ ] Verify URL parameters are validated
- [ ] Verify confirmation is always required for risky operations

---

## Test Results Summary

| Category | Total | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Startup | 5 | | | |
| Protocol | 10 | | | |
| Execution | 8 | | | |
| Navigation | 5 | | | |
| Settings | 7 | | | |
| History | 6 | | | |
| System Tray | 4 | | | |
| Window | 7 | | | |
| Notifications | 4 | | | |
| Performance | 5 | | | |
| Errors | 4 | | | |
| Accessibility | 4 | | | |
| Security | 3 | | | |
| **TOTAL** | **72** | | | |

---

## Known Issues

1. _[Add any known issues found during testing]_

---

## Sign-off

**Tested By**: _______________
**Date**: _______________
**Version**: 1.0.0-beta.1
**Result**: [ ] PASS / [ ] FAIL
**Comments**: _______________
