# AI Agent Instructions for Extensity

## Project Overview
Extensity is a Chrome extension for quickly enabling/disabling extensions and managing extension groups through profiles. The project uses a Manifest V3 architecture and follows specific patterns for Chrome extension development.

## Key Architecture Components

### Core Components
- `js/engine.js` - Core extension management logic
- `js/profiles.js` - Profile management system for grouping extensions
- `js/migration.js` - Service worker for background tasks and data migration
- `js/options.js` - Settings management
- `js/index.js` - Main popup UI logic

### UI Architecture
- Uses Knockout.js (3.5.1) for UI bindings with Knockout Secure Binding
- Underscore.js for utility functions
- No jQuery dependency (removed in v1.8.0)
- SASS-based styling (migrated from CSSO)

## Development Workflow

### Building the Extension
```bash
# Install build dependencies
npm install -g uglify-js sass

# Build distributable version
make
```

### Key Development Patterns
1. Chrome API Usage
   - Uses `chrome.management` API for extension control
   - Uses `chrome.storage` for sync/local data persistence
   - Limited permissions model: only `management` and `storage`

2. Data Management
   - Profile data stored in Chrome Storage with local fallback when exceeding quota
   - Migration system for handling version updates (`migration.js`)
   - "Always On" and "Favorite Extensions" lists persist across sessions

3. UI Conventions
   - Dark mode support based on system settings
   - Popup interface with search functionality
   - Separate options page for configuration
   - Extension grouping with toggleable sections

## Common Tasks

### Adding New Features
1. For UI changes, modify relevant HTML files (`index.html`, `options.html`, `profiles.html`)
2. Add corresponding JS logic in `js/` directory
3. Update styles in SASS files
4. Run `make` to build

### Testing
Test changes across these key scenarios:
- Extension enable/disable functionality
- Profile management operations
- Data sync between devices
- Dark/light mode transitions
- Storage quota handling

## Integration Points
- Chrome Extensions API (Manifest V3)
- Chrome Storage Sync API
- System theme detection for dark mode

## Project-Specific Conventions
1. Version numbering: Uses semantic versioning (e.g., v1.14.0)
2. Feature flags: None currently implemented
3. Dependencies: Minimal external dependencies, prefers vanilla JS
4. Build artifacts: Generated through Makefile system