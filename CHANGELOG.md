# Changelog

All notable changes to the "vscode-codeforces" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-03-08

### Fixed
- Duplicate "Input" and "Output" headers in Problem Preview when switching problems
- Minor UI alignment issues in Profile view

### Added
- Support for Open VSX Registry deployment

## [0.2.1] - 2026-03-08

### Fixed
- Problem statement parsing for certain Codeforces HTML structures
- Local testing bug where some sample inputs were not correctly captured

## [0.2.0] - 2026-03-08

### Added
- Contest Detail Panel: rich in-extension contest view with user rank, rating change, hacks, and per-problem submission status
- Standings Panel: in-extension paginated standings with friends filter
- Solve streak tracker: current and longest consecutive daily solve streaks shown in Profile view
- Problem of the Day: daily recommended problem based on user rating (command + sidebar category)
- Contest-specific submission endpoint: submits to `/contest/{id}/submit` during running contests for correct language selector
- `autoOpenContestProblems` setting now works: opens all contest problems automatically when a CODING contest is viewed

## [0.1.0] - 2024-01-01

### Added
- Initial release
- Problem Explorer with filtering by rating and tags
- Contest Explorer with upcoming, running, and recent contests
- Problem Preview with syntax highlighted problem statements
- Local testing with sample test cases
- Code submission support
- User profile and rating history
- Multiple language support (C++, Python, Java, Kotlin, Rust, Go, C#, JavaScript)
- CodeLens actions for quick submit and test
- Keyboard shortcuts for common actions
- Status bar integration
- Contest reminders
- Star/favorite problems feature
- Custom test input support
