# Obsidian Post

An Obsidian plugin for creating SNS-style posts with automatic directory organization.

## Features

- **SNS-style Posting**: Create quick posts similar to Twitter/X or Memos
- **Automatic Organization**: Posts are automatically saved to `post/YYYY/MM/DD-HHMMSS.md`
- **Posts List View**: Browse all your posts in a modal
- **Easy Access**: Ribbon button and command palette support

## Installation

### From Obsidian Plugin Browser (Coming Soon)

This plugin will be available on the Obsidian community plugins marketplace.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [releases](https://github.com/your-username/obsidian-post/releases)
2. Create a folder `YOUR_VAULT/.obsidian/plugins/obsidian-post/`
3. Place the three files in that folder
4. Reload Obsidian or restart it
5. Enable the plugin in **Settings > Community plugins > Obsidian Post**

## Usage

### Creating a Post

1. Click the pencil icon in the ribbon (left sidebar)
2. Or use the command palette (`Ctrl/Cmd + P`) and search for "New Post"
3. Type your post content
4. Click "Post" to save

Posts are automatically saved with the following structure:
```
post/
├── 2025/
│   ├── 01/
│   │   ├── 05-093045.md
│   │   └── 05-143022.md
│   └── 02/
│       └── 01-120000.md
```

### Viewing Posts

1. Click the command palette (`Ctrl/Cmd + P`)
2. Search for "Open Posts List"
3. Browse all your posts
4. Click on any post to open it in the editor

## Settings

- **Post Directory**: Choose where to store posts (default: `post`)

## Development

### Building

```bash
npm install
npm run build
```

### Development Mode

```bash
npm run dev
```

This will watch for changes and rebuild automatically.

## License

MIT
