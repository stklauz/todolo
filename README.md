<img width="1136" height="840" alt="Screenshot 2025-09-29 at 08 41 33" src="https://github.com/user-attachments/assets/eb6472af-786d-4d38-b9df-a67a4fb80334" />

# Todolo

A minimal desktop todo app built with Electron and React. Your data stays local, no accounts, no cloud.

## What it does

- **Type and press Enter** to create todos. Press Enter again to create another one below.
- **Tab/Shift+Tab** to indent/outdent items (creates subtasks)
- **Click checkbox** to complete items
- **Drag todos** up/down to reorder them
- **Multiple lists** in the sidebar - click to switch between them
- **Click list names** to rename them
- **Completion sounds** when you check things off
- **Hide completed items** toggle in the menu (three dots)

## What it doesn't do (by design)

- No login, no cloud sync, no accounts
- No fancy themes or customization (yet)
- No due dates, priorities, or tags
- No collaboration or sharing

## Download

**[Download Todolo →](https://github.com/stklauz/todolo/releases)**

_Note: macOS might block the app - right-click and "Open" if that happens._

## Development

```bash
git clone https://github.com/stklauz/todolo.git
cd todolo
npm install
npm start
```

**Scripts:**

- `npm start` - Development mode with hot reload
- `npm run build` - Build for production
- `npm run package` - Create installer for current platform
- `npm run lint` - Check code style
- `npm test` - Run tests

### Development vs Production Data

- Development (`npm start`) stores data in a separate app folder so it never mixes with your installed app data (`Todolo-Dev/`)
- Production (packaged/installed app) uses the regular folders listed above (`Todolo`).
- Result: Dev and Prod run from different directories and use different databases by default.

## Tech Stack

- Electron + React + TypeScript
- SQLite for local storage
- CSS Modules for styling

## Future Plans

- Themes and customization options
- Export/import functionality
- Keyboard shortcuts customization

## Support

- [GitHub Issues](https://github.com/stklauz/todolo/issues) for bugs / feature requests
- [GitHub Project](https://github.com/users/stklauz/projects/1) for checking progress

## License

MIT
