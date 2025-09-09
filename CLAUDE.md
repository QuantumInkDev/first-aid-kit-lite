# First Aid Kit Lite - Development Guidelines

**Last Updated**: January 9, 2025  
**Project Phase**: Project Initialization  
**Current Version**: v0.1.0-alpha  

## 🚀 Project Overview

First Aid Kit Lite is an Electron desktop application that enables secure, browser-triggered execution of PowerShell maintenance scripts through custom protocol handlers (`first-aid-kit://` and `fak://`).

### Key Features
- Custom protocol handlers for browser integration
- Secure PowerShell script execution with sandboxing  
- Enhanced confirmation dialogs with risk assessment
- Windows 11 native toast notifications
- Comprehensive audit logging
- User-friendly React TypeScript interface

## 📋 Session Management

### Before Starting Work
1. **ALWAYS** read `SESSION_STATUS.md` for current status and continue marker
2. Check `.claude/settings.local.json` for permission updates
3. Review `planning/current-sprint.md` for current phase tasks
4. Check Serena Memory for project context
5. Verify git status and pull latest changes

### After Completing Work
1. Update `SESSION_STATUS.md` with progress and next steps
2. Move 🔴 **CONTINUE HERE** marker to stopping point
3. Update `planning/current-sprint.md` with task status
4. Clean up TodoWrite list
5. Update Serena Memory with session insights
6. **MANDATORY**: Commit and push to GitHub

## 🛠️ Development Environment

### Required Tools
- **Node.js**: v18+ LTS
- **npm**: v9+
- **Git**: Latest version
- **PowerShell**: v5+ (Windows PowerShell or PowerShell Core)
- **Windows 11**: Primary development and testing platform
- **VS Code**: Recommended IDE with extensions:
  - TypeScript and JavaScript Language Features
  - Electron Debug
  - PowerShell Extension
  - Tailwind CSS IntelliSense

### Project Structure
```
first-aid-kit-lite/
├── planning/              # All planning documents
├── src/
│   ├── main/             # Electron main process
│   ├── renderer/         # React application  
│   ├── shared/           # Shared types and utilities
│   └── preload/          # Secure IPC bridge
├── scripts/              # PowerShell scripts
├── tests/                # Test files
├── CLAUDE.md            # This file
└── SESSION_STATUS.md    # Current session status
```

## 🔒 Security Guidelines

### Critical Security Requirements
1. **Never disable context isolation** in Electron
2. **Always validate all inputs** from protocol handlers and IPC
3. **Sandbox PowerShell execution** with restricted permissions
4. **Never execute untrusted scripts** without validation
5. **Log all script executions** for audit trails
6. **Implement rate limiting** to prevent abuse

### PowerShell Security
- Use `child_process.spawn()` instead of `node-powershell` for better control
- Always specify `-ExecutionPolicy Bypass` with explicit script paths
- Validate and sanitize all script parameters
- Implement timeout mechanisms for script execution
- Run scripts with minimal required privileges

### IPC Security
- Use typed interfaces for all IPC messages
- Validate all data crossing process boundaries
- Never expose Node.js APIs directly to renderer
- Use preload script as secure bridge only

## 🎨 Code Standards

### TypeScript Configuration
- **Strict mode enabled**: No `any` types allowed
- **Explicit return types** for all public functions
- **Interface definitions** for all data structures
- **JSDoc comments** for public APIs

### React Patterns
```typescript
// Use functional components with hooks
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<StateType>(initialState);
  
  // Use proper TypeScript typing
  const handleAction = useCallback((param: ParamType): void => {
    // Implementation
  }, [dependencies]);
  
  return (
    <div className="tailwind-classes">
      {/* Component content */}
    </div>
  );
};
```

### File Naming Conventions
- **React Components**: PascalCase (`ConfirmationDialog.tsx`)
- **Hooks**: camelCase with `use` prefix (`useScriptExecution.ts`)
- **Services**: camelCase (`scriptExecutor.ts`)
- **Types**: kebab-case (`script-execution.types.ts`)
- **Constants**: camelCase files, UPPER_SNAKE_CASE values

## 🧪 Testing Strategy

### Test Coverage Requirements
- **Unit Tests**: >80% coverage for core modules
- **Integration Tests**: All critical user flows
- **E2E Tests**: Primary protocol handling scenarios  
- **Security Tests**: Input validation and sandboxing

### Test File Organization
```
tests/
├── unit/
│   ├── main/             # Main process tests
│   └── renderer/         # React component tests
├── integration/          # Cross-process tests
├── e2e/                 # End-to-end tests
└── security/            # Security validation tests
```

## 📦 Build & Deployment

### Development Commands
```bash
# Start development server
npm run dev

# Run tests
npm test

# Type checking  
npm run type-check

# Lint code
npm run lint

# Build for production
npm run build

# Package application
npm run package
```

### Packaging Requirements
- **Code signing**: Required for production releases
- **Protocol registration**: Must be included in installer
- **Auto-updater**: Configured for seamless updates
- **Error reporting**: Integrated crash reporting

## 🔄 Git Workflow

### Branch Strategy
- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/***: Individual feature development
- **hotfix/***: Critical bug fixes

### Commit Message Format
```
Session YYYY-MM-DD: Brief description of changes

- Detailed change 1
- Detailed change 2  
- Important notes or decisions made

Closes #issue-number (if applicable)
```

### Pre-Commit Checklist
- [ ] All TypeScript errors resolved
- [ ] Tests passing
- [ ] Code formatted and linted
- [ ] No console errors in development
- [ ] Documentation updated
- [ ] Session status updated

## 📊 Performance Requirements

### Response Time Targets
- **Protocol handler activation**: <500ms
- **Application startup**: <3 seconds  
- **Script execution overhead**: <100ms
- **UI responsiveness**: 60fps animations

### Memory Usage Limits
- **Idle application**: <150MB
- **During script execution**: <300MB
- **Maximum concurrent scripts**: 3

## 🐛 Debugging Guidelines

### Common Issues

#### Protocol Handler Not Working
```bash
# Check Windows registry
reg query "HKEY_CLASSES_ROOT\first-aid-kit"

# Re-register protocols
npm run register-protocols
```

#### PowerShell Execution Fails
```powershell
# Test PowerShell availability
Get-ExecutionPolicy

# Check script permissions
Get-AuthenticodeSignature .\script.ps1
```

#### IPC Communication Issues
```typescript
// Enable IPC debugging
process.env.NODE_ENV = 'development';
```

### Logging Configuration
- **Development**: Console + file logging with DEBUG level
- **Production**: File logging only with INFO level  
- **Log rotation**: Daily rotation, 30-day retention
- **Error aggregation**: Structured error reporting

## 📚 Documentation Requirements

### Code Documentation
- **JSDoc comments** for all public APIs
- **README files** for each major module
- **Type definitions** with descriptive comments
- **Usage examples** for complex functions

### User Documentation
- **Installation guide** with system requirements
- **User manual** with screenshots
- **Troubleshooting guide** for common issues
- **Security guide** for IT administrators

## 🚨 Critical Development Notes

### Immediate Priorities
1. ✅ Project structure and planning complete
2. 🔄 Initialize Electron with TypeScript
3. ⏳ Implement protocol handlers
4. ⏳ Build PowerShell execution engine
5. ⏳ Create React UI components

### Known Issues & Workarounds
- **Issue**: None currently identified
- **Workaround**: N/A

### Important Decisions Made
1. **PowerShell Integration**: Use `child_process.spawn()` for better control
2. **UI Framework**: React with TypeScript and ShadCN components  
3. **Styling**: TailwindCSS for rapid development
4. **Database**: SQLite for logging and settings storage
5. **Testing**: Jest + React Testing Library + Playwright

### Environment-Specific Notes
- **Windows 11**: Primary development platform
- **PowerShell**: Must support both Windows PowerShell 5.1 and PowerShell Core 7+
- **Browsers**: Test protocol handlers in Chrome, Firefox, Edge

## 🔗 Useful Resources

### Documentation Links
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [PowerShell Execution Policies](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)
- [Windows Protocol Handlers](https://docs.microsoft.com/en-us/windows/win32/shell/fa-intro)
- [React TypeScript Best Practices](https://react-typescript-cheatsheet.netlify.app/)

### Internal References
- **PRD**: `planning/PRD.md`
- **Architecture**: `planning/architecture.md` 
- **Implementation Plan**: `planning/implementation-phases.md`
- **Session Protocols**: `planning/session-protocols.md`

---

## ⚠️ CRITICAL REMINDERS

1. **NEVER commit secrets** or sensitive information
2. **ALWAYS test protocol handlers** after changes
3. **VALIDATE all PowerShell inputs** for security
4. **UPDATE SESSION_STATUS.md** at end of each session
5. **PUSH TO GITHUB** after every session (non-negotiable)

**Remember**: This is a security-sensitive application. When in doubt about security implications, err on the side of caution and implement additional validation/sandboxing.

---

**Next Session**: See `SESSION_STATUS.md` for current status and continue marker.