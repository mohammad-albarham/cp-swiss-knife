# Codeforces for VS Code

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Solve Codeforces problems directly in VS Code! This extension brings the full Codeforces experience to your favorite editor.

## Features

### Problem Management
- **Browse Problems**: Navigate through all Codeforces problems organized by rating, tags, or contest
- **Search Problems**: Quickly find problems by ID or name
- **Problem Preview**: View problem statements, constraints, and sample test cases in VS Code
- **Star Problems**: Save favorite problems for later

![Problem Explorer](https://via.placeholder.com/800x400?text=Problem+Explorer+Screenshot)

### Contest Integration
- **Contest List**: View upcoming, running, and recent contests
- **Live Countdown**: See time remaining for running contests in status bar
- **Contest Registration**: Quick access to contest registration
- **Virtual Participation**: Start virtual contests from VS Code

![Contest Explorer](https://via.placeholder.com/800x400?text=Contest+Explorer+Screenshot)

### Code Submission
- **Submit Solutions**: Submit your code directly from VS Code
- **Verdict Tracking**: Real-time verdict updates with visual feedback
- **Local Testing**: Run sample tests locally before submitting
- **Custom Tests**: Test with your own input data

### User Profile
- **Rating Graph**: Visualize your rating history
- **Statistics**: Track solved problems and contest participation
- **Recent Submissions**: View your submission history

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Codeforces"
4. Click Install

Or install from the command line:
```bash
code --install-extension codeforces-extension.vscode-codeforces
```

## Requirements

- VS Code 1.85.0 or higher
- Node.js 16+ (for local testing with certain languages)
- Compilers for your preferred languages:
  - **C++**: g++ (with C++17 support)
  - **Python**: python3
  - **Java**: javac, java
  - **Other languages**: respective compilers/interpreters

## Quick Start

1. **Login**: Click "Login" in the Codeforces sidebar or run `Codeforces: Login` command
2. **Browse Problems**: Expand the Problems section in the sidebar
3. **Open a Problem**: Click on any problem to preview it
4. **Start Coding**: Click "Open in Editor" to create a solution file
5. **Test Locally**: Press `Ctrl+Alt+T` to run sample tests
6. **Submit**: Press `Ctrl+Alt+S` to submit your solution

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `Codeforces: Login` | - | Login with your Codeforces credentials |
| `Codeforces: Logout` | - | Logout from Codeforces |
| `Codeforces: Submit Solution` | `Ctrl+Alt+S` | Submit current file |
| `Codeforces: Run Sample Tests` | `Ctrl+Alt+T` | Run sample test cases |
| `Codeforces: Preview Problem` | `Ctrl+Alt+P` | Preview problem description |
| `Codeforces: Open Problem` | - | Open a problem by ID |
| `Codeforces: Search Problems` | - | Search for problems |
| `Codeforces: Set Default Language` | - | Set your preferred language |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeforces.handle` | `""` | Your Codeforces handle |
| `codeforces.workspaceFolder` | `~/.codeforces` | Folder to store solution files |
| `codeforces.defaultLanguage` | `cpp` | Default programming language |
| `codeforces.cppCompiler` | `g++` | C++ compiler command |
| `codeforces.cppFlags` | `-std=c++17 -O2` | C++ compiler flags |
| `codeforces.pythonCommand` | `python3` | Python interpreter |
| `codeforces.showDifficultyBadges` | `true` | Show difficulty badges on problems |
| `codeforces.showSolvedIndicator` | `true` | Show solved status on problems |
| `codeforces.contestReminders` | `true` | Show contest notifications |
| `codeforces.reminderMinutesBefore` | `15` | Minutes before contest for reminder |
| `codeforces.showStatusBar` | `true` | Show status bar item |
| `codeforces.includeGym` | `false` | Include Gym contests |
| `codeforces.friendHandles` | `[]` | List of friend handles to track |

## Supported Languages

- C++ (GNU G++17)
- Python 3
- Java 8
- Kotlin
- Rust
- Go
- C# (Mono)
- JavaScript (Node.js)

## File Structure

Solution files are organized as follows:
```
~/.codeforces/
├── problemset/
│   ├── 1A-Theatre_Square/
│   │   ├── cf_1A.cpp
│   │   ├── input1.txt
│   │   ├── output1.txt
│   │   └── .problem.json
│   └── 4A-Watermelon/
│       └── cf_4A.py
└── contests/
    └── 1900/
        ├── A/
        ├── B/
        └── ...
```

## API Authentication

For full functionality (submitting solutions, viewing friends), you can optionally provide API credentials:

1. Go to [Codeforces API page](https://codeforces.com/settings/api)
2. Generate an API key
3. Enter the key and secret when prompted during login

**Note**: API credentials are stored securely using VS Code's SecretStorage.

## CodeLens Actions

When editing a Codeforces solution file (prefixed with `cf_`), you'll see action buttons at the top:

- **Submit**: Submit your solution to Codeforces
- **Run Tests**: Run all sample test cases
- **Custom Test**: Run with custom input
- **Preview**: View the problem statement

## Troubleshooting

### Common Issues

**Tests not running?**
- Ensure you have the required compiler/interpreter installed
- Check the `codeforces.cppCompiler` and `codeforces.pythonCommand` settings

**Submission not working?**
- Make sure you're logged in
- Check your internet connection
- Some features require API key authentication

**Problems not loading?**
- Check your internet connection
- Try refreshing with the refresh button
- Clear cache by reloading VS Code

### Debug Logs

View extension logs:
1. Open Command Palette (Ctrl+Shift+P)
2. Run "Developer: Show Logs"
3. Select "Codeforces" from the dropdown

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Codeforces](https://codeforces.com) for the amazing competitive programming platform
- [vscode-leetcode](https://github.com/LeetCode-OpenSource/vscode-leetcode) for inspiration
- All contributors and users of this extension

---

**Happy Coding!** 🚀
