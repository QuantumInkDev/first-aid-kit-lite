# First Aid Kit Lite - Session Management Protocols

## Overview

This document defines the standardized protocols for managing development sessions to ensure continuity, context preservation, and efficient progress tracking across multiple work sessions.

## Session Start Protocol

### ✅ Pre-Session Checklist

Execute these steps at the beginning of each development session:

1. **[ ] Read CLAUDE.md file completely**
   - Review any critical updates or changes
   - Check for new development guidelines
   - Note any environment-specific instructions
   - Location: `./CLAUDE.md`

2. **[ ] Read SESSION_STATUS.md for current status and continue marker**
   - Look for the 🔴 **CONTINUE HERE** marker
   - Review what was completed in the last session
   - Check for any blocking issues or dependencies
   - Note the current phase and sprint status
   - Location: `./SESSION_STATUS.md`

3. **[ ] Check .claude/settings.local.json for duplicate permissions**
   - Review permission list for duplicates
   - Clean up any redundant entries if found
   - Ensure permissions align with current development needs
   - Location: `./.claude/settings.local.json`

4. **[ ] Read planning/current-sprint.md for Phase 2 production tasks**
   - Review current sprint objectives
   - Check task priorities and dependencies
   - Note any deadline or milestone information
   - Update task assignments if needed
   - Location: `./planning/current-sprint.md`

5. **[ ] Check Serena Memory for project context**
   - Use `mcp__serena__list_memories` to see available memories
   - Read relevant memories with `mcp__serena__read_memory`
   - Focus on memories related to current work phase
   - Update understanding of project status and decisions

6. **[ ] Review recent git commit history**
   - Check last 5-10 commits for recent changes
   - Understand what was implemented recently
   - Note any potential merge conflicts or issues
   - Command: `git log --oneline -10`

7. **[ ] Verify development environment**
   - Ensure all required tools are available
   - Check that dependencies are installed
   - Verify build process is working
   - Test that application starts without errors

### Session Start Commands

```bash
# Quick status check
git status
git log --oneline -5

# Environment verification
npm list --depth=0
npm run dev # Should start without errors

# Check for any pending issues
npm audit --audit-level=high
```

---

## Session End Protocol

### 📝 Post-Session Checklist

Execute these steps at the end of each development session:

1. **[ ] Update SESSION_STATUS.md with session progress and next steps**
   - Document what was accomplished this session
   - List any issues encountered and their resolution status
   - Note the current state of implementation
   - Add detailed next steps for the following session
   - Move the 🔴 **CONTINUE HERE** marker to the appropriate stopping point

2. **[ ] Update planning/current-sprint.md with detailed progress**
   - Mark completed tasks as ✅ Done
   - Update in-progress tasks with current status
   - Add any new tasks discovered during implementation
   - Adjust time estimates based on actual progress
   - Note any blockers or dependencies

3. **[ ] Move "🔴 CONTINUE HERE" marker in SESSION_STATUS.md to stopping point**
   - Place marker at the exact location where work should resume
   - Include context about the current state
   - Add any important notes about the stopping point
   - Reference specific files or line numbers if relevant

4. **[ ] Clean up TodoWrite list (mark completed, remove stale items)**
   - Mark all completed tasks as "completed"
   - Remove tasks that are no longer relevant
   - Update task descriptions to reflect current state
   - Ensure only active tasks remain pending

5. **[ ] Update planning/implementation-progress.md if major features completed**
   - Document completion of major milestones
   - Update progress percentages for each phase
   - Note any significant architectural decisions
   - Record performance metrics if applicable

6. **[ ] Update this file's "Last Updated" date if needed**
   - Update CLAUDE.md if development guidelines changed
   - Add any new instructions for future sessions
   - Note any environment changes or requirements
   - Document lessons learned

7. **[ ] Check .claude/settings.local.json for new duplicates (clean if needed)**
   - Review permissions added during this session
   - Remove any duplicates that may have been created
   - Ensure permission list is clean and organized
   - Validate that all permissions are still needed

8. **[ ] Update Serena Memory with current project status**
   - Use `mcp__serena__write_memory` to update project status
   - Include key decisions made during the session
   - Document any architectural changes or insights
   - Store important context for future sessions

9. **[ ] Commit with descriptive message: "Session [date]: [what was completed]"**
   - Stage all changes: `git add .`
   - Create descriptive commit message following format:
     ```
     Session 2025-01-XX: Implemented PowerShell execution engine and script registry
     
     - Added PowerShell executor with sandboxing
     - Created script registry system
     - Implemented input validation for scripts
     - Added comprehensive error handling
     - Set up logging for script executions
     ```
   - Commit: `git commit -m "Session message"`

10. **[ ] Push to GitHub - NOT OPTIONAL, do it every time at session end**
    - Always push changes to remote repository
    - Ensure backup and continuity for next session
    - Command: `git push origin main`
    - Verify push was successful

### Session End Commands

```bash
# Final status check
git status
git diff --staged

# Commit session work
git add .
git commit -m "Session $(date +%Y-%m-%d): [describe work completed]"

# Push to remote (MANDATORY)
git push origin main

# Final verification
git log --oneline -3
```

---

## File Templates

### SESSION_STATUS.md Template

```markdown
# First Aid Kit Lite - Session Status

## Current Status: [Phase Name]

**Last Updated**: [Date and Time]
**Current Sprint**: [Sprint Name/Number]
**Overall Progress**: [XX]% complete

## 🔴 CONTINUE HERE

**Next Action**: [Specific next task to work on]
**Context**: [Important context about where we stopped]
**Files to Focus On**: 
- [File 1] - [What needs to be done]
- [File 2] - [What needs to be done]

## Recent Progress

### Session [Date]
- ✅ [Completed Task 1]
- ✅ [Completed Task 2]  
- 🔄 [In Progress Task] - [Status details]
- ❌ [Blocked Task] - [Blocker description]

### Key Decisions Made
- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

### Issues and Blockers
- [Issue 1]: [Status and resolution plan]
- [Issue 2]: [Status and resolution plan]

## Implementation Status

### Phase 1: Project Foundation ✅ Complete
- All setup tasks completed
- Environment configured correctly

### Phase 2: Core Infrastructure 🔄 In Progress
- [List current status of each sub-task]

### Phase 3: PowerShell Integration ⏳ Pending
- Waiting for Phase 2 completion

## Next Session Priorities

1. [High Priority Task]
2. [Medium Priority Task]  
3. [Low Priority Task]

## Important Notes

- [Any critical information for next session]
- [Environment issues to be aware of]
- [Dependencies or external factors]
```

### current-sprint.md Template

```markdown
# Current Sprint: [Sprint Name]

**Sprint Duration**: [Start Date] - [End Date]
**Sprint Goals**: [Main objectives for this sprint]
**Current Phase**: [Phase Number and Name]

## Sprint Backlog

### High Priority
- [ ] **Task Name** - [Description] - Est: [Time] - Assigned: [Person]
- [x] **Completed Task** - [Description] - Completed: [Date]

### Medium Priority
- [ ] **Task Name** - [Description] - Est: [Time] - Assigned: [Person]

### Low Priority
- [ ] **Task Name** - [Description] - Est: [Time] - Assigned: [Person]

## Sprint Progress

**Overall Completion**: [XX]%
**Tasks Completed**: [X] / [Y]
**Time Spent**: [X] hours of [Y] estimated

### Burn-down Tracking
- Day 1: [X] tasks remaining
- Day 2: [X] tasks remaining
- Day 3: [X] tasks remaining

## Blockers and Issues

- **Blocker 1**: [Description] - Status: [Status] - ETA: [Date]
- **Issue 1**: [Description] - Impact: [High/Medium/Low] - Resolution: [Plan]

## Sprint Review Notes

### What Went Well
- [Success 1]
- [Success 2]

### What Could Be Improved
- [Improvement 1]
- [Improvement 2]

### Key Learnings
- [Learning 1]
- [Learning 2]
```

## Memory Management Guidelines

### What to Store in Serena Memory

- **Project Architecture Decisions**: Key architectural choices and rationale
- **Implementation Patterns**: Successful code patterns and approaches
- **Security Considerations**: Important security decisions and implementations
- **Performance Insights**: Optimization techniques and benchmark results
- **Integration Details**: How different components work together
- **Error Resolution**: Solutions to complex problems encountered

### Memory Naming Conventions

- `project-architecture-[date]` - Architecture decisions and patterns
- `security-implementation-[date]` - Security-related implementations
- `powershell-integration-[date]` - PowerShell-specific implementation details
- `ui-patterns-[date]` - React/UI implementation patterns
- `performance-optimizations-[date]` - Performance improvements
- `troubleshooting-[date]` - Common issues and solutions

### Sample Memory Content

```markdown
# PowerShell Integration Implementation

**Date**: 2024-01-XX
**Phase**: PowerShell Integration
**Key Decision**: Use child_process instead of node-powershell

## Architecture Decision

Chose to use Node.js child_process.spawn() instead of node-powershell package because:
1. Better control over execution environment
2. More reliable error handling
3. Better resource management
4. Active maintenance and security updates

## Implementation Pattern

```typescript
const executeScript = async (scriptPath: string, params: string[]): Promise<ExecutionResult> => {
  return new Promise((resolve, reject) => {
    const process = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...params]);
    // Implementation details...
  });
}
```

## Security Considerations

- Always validate script paths
- Sanitize all parameters
- Run with minimal privileges
- Implement timeout mechanisms
- Log all execution attempts
```

---

## Troubleshooting Common Session Issues

### Git Issues

**Problem**: Merge conflicts after pulling changes
```bash
# Resolution
git status
git diff
# Resolve conflicts manually
git add .
git commit -m "Resolve merge conflicts"
```

**Problem**: Uncommitted changes blocking git operations
```bash
# Resolution
git stash
git pull origin main
git stash pop
# Resolve any conflicts
```

### Development Environment Issues

**Problem**: npm dependencies out of sync
```bash
# Resolution
rm -rf node_modules package-lock.json
npm install
```

**Problem**: TypeScript compilation errors
```bash
# Resolution
npm run type-check
# Fix reported errors
npm run build
```

### Electron Issues

**Problem**: Protocol handlers not working
```bash
# Resolution
# Check Windows registry
reg query "HKEY_CLASSES_ROOT\first-aid-kit"
# Re-register if necessary
```

---

## Session Quality Metrics

### Productivity Metrics

- **Session Length**: Target 2-4 hours per session
- **Task Completion Rate**: >80% of planned tasks
- **Code Quality**: Zero TypeScript errors, passing tests
- **Documentation**: All major changes documented

### Quality Gates

Before ending any session:
- ✅ Code compiles without errors
- ✅ All tests pass
- ✅ No console errors in development
- ✅ Git repository is clean and pushed
- ✅ Documentation is updated

### Success Indicators

- Smooth session transitions (< 10 minutes to get oriented)
- Clear understanding of next steps
- No work lost between sessions
- Consistent progress toward milestones
- Maintainable and clean codebase

---

This session management protocol ensures that development work proceeds efficiently and maintains continuity across multiple development sessions, regardless of time gaps between working periods.