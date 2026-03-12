# Local Development — Extension Install/Uninstall

## Build the VSIX

```bash
npm run compile && npm run bundle
npx @vscode/vsce package
```

This produces `cp-swiss-knife-<version>.vsix` in the project root.

---

## VS Code

**Install / Reinstall:**

```bash
code --install-extension cp-swiss-knife-0.2.4.vsix --force
```

**Uninstall:**

```bash
code --uninstall-extension albarham.cp-swiss-knife
```

---

## Antigravity IDE

Extensions are stored in `~/.antigravity/extensions/`.

**Install / Reinstall:**

```bash
~/.antigravity/antigravity/bin/antigravity --install-extension cp-swiss-knife-0.2.4.vsix --force
```

**Uninstall:**

```bash
~/.antigravity/antigravity/bin/antigravity --uninstall-extension albarham.cp-swiss-knife
```

---

> After installing or uninstalling, reload the window: `Cmd+Shift+P` → **Reload Window**.
