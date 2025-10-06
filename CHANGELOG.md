# Changelog

All notable changes to Todolo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-01-27

### Added
- **Duplicate Lists Feature**: Complete implementation of list duplication functionality
  - Core functionality with proper state management and database operations
  - UI integration with accessibility improvements
  - Observability and monitoring with comprehensive logging
  - Three-phase implementation covering core functionality, UI integration, and monitoring
- Enhanced development workflow with updated agent rules
- Improved error handling and state management for list operations

### Fixed
- Lists now delete persistently: added explicit DB + IPC delete path to remove lists and their todos. Prevents deleted lists from reappearing on restart.
- Fixed issue with duplicate lists not duplicating todo states correctly
- Improved list deletion reliability and data consistency

### Added
- Targeted logs for delete flow across UI, storage, and DB for observability.
- Tests for delete behavior: UI integration test driving the delete button, and storage IPC tests for the new delete endpoint.
- Comprehensive monitoring for duplicate list operations
- Enhanced accessibility for list management features

## [1.2.1] - 2025-10-06

### Fixed
- Lists now delete persistently: added explicit DB + IPC delete path to remove lists and their todos. Prevents deleted lists from reappearing on restart.

### Added
- Targeted logs for delete flow across UI, storage, and DB for observability.
- Tests for delete behavior: UI integration test driving the delete button, and storage IPC tests for the new delete endpoint.

## [1.2.0] - 2025-10-06

### Added
- Comprehensive testing infrastructure with Jest and React Testing Library
- Pre-commit hooks with Husky for code quality
- ESLint configuration with comprehensive rules
- UI behavior tests for user interactions
- Negative path testing for error scenarios
- Storage API unit tests
- Debug logger with advanced capabilities
- Migration and corruption robustness testing
- CI stability and reporting improvements
- Documentation for testing epic and development rules
- CHANGELOG.md for tracking project evolution

### Changed
- Improved code quality with automated linting
- Enhanced test coverage and stability
- Better development workflow with pre-commit checks
- Moved documentation and agent instructions to organized structure

### Fixed
- Timing issues in debug tests
- Lint errors across the codebase
- Test setup and Jest configuration

## [1.1.2] - 2025-09-30

### Added
- Development database separation
- Separate app folders for dev vs production data
- Enhanced documentation for development workflow

### Changed
- Development mode now uses `Todolo-Dev` folder
- Production uses standard `Todolo` folder
- Improved data isolation between environments

## [1.1.1] - 2025-09-29

### Fixed
- Indentation issues in todo items
- Title editing behavior improvements
- UI consistency fixes

## [1.1.0] - 2025-09-28

### Added
- Hide completed items functionality
- Menu option to toggle completed items visibility
- Improved user experience for managing completed todos

### Changed
- Menu placement and organization
- UI layout improvements

## [1.0.6] - 2025-09-26

### Added
- Debug mode for development and troubleshooting
- Performance improvements

### Fixed
- Various bug fixes and stability improvements

## [1.0.5] - 2025-09-26

### Added
- Async file saving for better performance

### Fixed
- Performance optimizations

## [1.0.4] - 2025-09-25

### Fixed
- Performance improvements and optimizations

## [1.0.3] - 2025-09-24

### Fixed
- Version syncing in release builds

## [1.0.2] - 2025-09-24

### Added
- Auto-update functionality

## [1.0.1] - 2025-09-24

### Fixed
- Initial bug fixes and improvements

## [1.0.0] - 2025-09-24

### Added
- Initial release of Todolo
- Basic todo functionality
- Multiple lists support
- Drag and drop reordering
- Subtask support with indentation
- Local SQLite database storage
- Cross-platform support (macOS, Windows, Linux)
- Auto-update functionality
- Completion sounds
- List management (create, rename, delete)
- Clean, minimal interface

### Features
- **Type and press Enter** to create todos
- **Tab/Shift+Tab** to indent/outdent items (subtasks)
- **Click checkbox** to complete items
- **Drag todos** up/down to reorder them
- **Multiple lists** in the sidebar
- **Click list names** to rename them
- **Completion sounds** when checking off items
- **Hide completed items** toggle

### Technical Details
- Built with Electron + React + TypeScript
- SQLite for local storage
- CSS Modules for styling
- No cloud sync, no accounts required
- Data stays local and private

---

## Planned Features

### Duplicate List Feature (In Development)
- **Phase 1**: Core functionality and UI smoke tests
- **Phase 2**: UI integration and accessibility
- **Phase 3**: Observability and performance

### Future Enhancements
- Themes and customization options
- Export/import functionality
- Keyboard shortcuts customization
- Enhanced UI/UX improvements

---

## Development Notes

### Testing Infrastructure
- Comprehensive test suite with Jest
- React Testing Library for component testing
- UI behavior tests for user interactions
- Negative path testing for error scenarios
- Storage API unit tests
- Debug logging and troubleshooting tools

### Code Quality
- ESLint configuration with comprehensive rules
- Pre-commit hooks with Husky
- Automated code formatting
- TypeScript strict mode
- Comprehensive error handling

### Development Workflow
- Development database separation
- Hot reload in development mode
- Automated testing and linting
- CI/CD pipeline improvements

---

## Support

- [GitHub Issues](https://github.com/stklauz/todolo/issues) for bugs and feature requests
- [GitHub Project](https://github.com/users/stklauz/projects/1) for progress tracking
- [Documentation](https://github.com/stklauz/todolo#readme) for setup and usage

---

## License

MIT License - see [LICENSE](LICENSE) file for details.
