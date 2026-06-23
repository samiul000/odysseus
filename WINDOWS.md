# Windows Native Compatibility

Odysseus was originally developed for Linux. This document tracks Windows-native
issues discovered during testing and the fixes applied to make it run directly
on Windows (without Docker or WSL).

## Overview

Running on Windows natively means the Python process is `cpython.exe` on NTFS,
not a Linux process on ext4 inside a container. Several assumptions that hold on
Linux break here:

| Category | Issue | Root Cause |
|---|---|---|
| **Subprocess** | `"python3"` hardcoded as command name | Windows has `python.exe`, not `python3.exe` |
| **Venv layout** | Code assumes `/bin/activate` and `/bin/python` | Windows venvs use `\Scripts\Activate.ps1` / `\Scripts\python.exe` |
| **PTY/Terminal** | `pty`, `fcntl`, `termios` are Unix-only | These modules raise `ImportError` or `AttributeError` on Windows |
| **tmux** | Background model downloads use `tmux` | tmux does not exist on Windows |
| **File permissions** | `os.chmod()` with Unix mode flags | Windows ignores many mode bits or raises `OSError` |
| **Temp paths** | Hardcoded `/tmp/` for session files | Windows uses `%TEMP%` |
| **User home** | Hardcoded `/home/pewds/` snapshot path | Windows has no `/home/` directory |

## Fixes Applied

### 1. python3 → sys.executable

**Files:** `routes/cookbook_routes.py`

Two local `subprocess.run(["python3", "-c", ...])` calls now use
`sys.executable` when running locally. The remote-SSH path keeps `"python3"`
because the target is always a POSIX server.

### 2. Platform-aware venv bin path

**Files:**
- `src/tool_implementations.py` — `venv_bin` uses `Scripts` on Windows, `bin` on POSIX
- `src/builtin_actions.py` — `env_prefix` activation path uses `Scripts/activate` on Windows
- `routes/shell_routes.py` — `site.USER_BASE` path uses `Scripts` on Windows
- `static/js/cookbook.js` — `_venvRootFromPath()` strips both `/bin/` and `\Scripts\` suffixes;
  `_buildServeCmd()` uses `/Scripts/` when `platform === 'windows'`;
  `_recipeDisplayText()` uses Windows-style suffix on Windows
- `static/js/cookbook-hwfit.js` — envPrefix uses `/Scripts/activate` on Windows

### 3. PTY / fcntl / termios guard

**Files:** `routes/shell_routes.py`

Already handled by the existing `try/except` import guard (lines 26–34) and the
`PTY_SUPPORTED` boolean (line 104). On Windows `pty` and `fcntl` are set to
`None` and every code path that uses them is guarded by `if PTY_SUPPORTED`.

### 4. tmux → detached process

**Files:** `routes/cookbook_routes.py`, `routes/shell_routes.py`

Local background execution on Windows bypasses tmux entirely. The
`_launch_local_detached()` function runs the same bash script through Git Bash
(or writes an error if Git Bash is not installed), writing a `.pid` file for
liveness polling — mirroring the tmux session model without tmux.

### 5. safe_chmod

**Files:** `core/platform_compat.py`

`safe_chmod()` wraps `os.chmod()` in a `try` that silently ignores failures on
Windows (where most mode bits are unsupported). Used everywhere the codebase
`chmod`s a script file before execution.

### 6. /tmp → tempfile.gettempdir()

**Files:** `src/tool_execution.py`

Hardcoded `/tmp/odysseus` paths replaced with `tempfile.gettempdir()` so
temporary files land in the system temp directory on any platform.

### 7. Hardcoded snapshot path removed

**Files:** `static/js/cookbookServe.js`

A developer-local snapshot path (`/home/pewds/...`) was replaced with the
repository ID lookup, fixing a crash when that path did not exist.

## Remaining Caveats

- **Git Bash required** for full Cookbook functionality. `launch-windows.ps1`
  detects Git Bash and uses it for background model downloads and the agent
  shell tool. The core chat UI works without it.
- **Local model serving** on Windows is limited to Ollama and llama.cpp.
  vLLM does not support Windows.
- **PTY-backed shell** sessions are unavailable on Windows, but the fallback
  `subprocess`-based shell works for all common commands.
- **numpy<2** is pinned for `fastembed` compatibility on Windows.
