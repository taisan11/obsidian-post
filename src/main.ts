import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
	WorkspaceLeaf,
} from 'obsidian';
import { PostView, VIEW_TYPE_POST } from './views/PostView';
import { PostInput } from './components/PostInput';

interface ObsidianPostSettings {
	postDirectory: string;
}

const DEFAULT_SETTINGS: ObsidianPostSettings = {
	postDirectory: 'post',
};

export default class ObsidianPostPlugin extends Plugin {
	//@ts-expect-error
	settings: ObsidianPostSettings;

	async onload() {
		await this.loadSettings();

		// Register custom view
		this.registerView(
			VIEW_TYPE_POST,
			(leaf) => new PostView(leaf, this)
		);

		// Create a ribbon button to open the post view
		this.addRibbonIcon('pencil', 'Open Posts', () => {
			this.activatePostsView();
		});

		// Add a command to open the posts view
		this.addCommand({
			id: 'obsidian-post:open-posts',
			name: 'Open Posts View',
			callback: () => {
				this.activatePostsView();
			},
		});

		// Add settings tab
		this.addSettingTab(new ObsidianPostSettingTab(this.app, this));

		// Register a code-block processor for ```postinput blocks
		this.registerMarkdownCodeBlockProcessor('postinput', (source, el, ctx) => {
			// clear existing rendered content
			if ((el as any).empty) {
				(el as any).empty();
			} else {
				el.innerHTML = '';
			}

			const container = el.createEl('div');
			container.addClass('obsidian-postinput-container');

			new PostInput(this, container, async () => {
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_POST);
				if (leaves.length > 0 && leaves[0].view && (leaves[0].view as any).resetAndRefreshPosts) {
					await (leaves[0].view as any).resetAndRefreshPosts();
				}
			});
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activatePostsView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_POST);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_POST, active: true });
			}
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async createPost(content: string): Promise<boolean> {
		try {
			const now = new Date();
			const timestamp = now.toISOString();

			// Create directory structure: post/YYYY/MM
			const dirPath = `${this.settings.postDirectory}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
			const dir = this.app.vault.getAbstractFileByPath(dirPath);

			if (!dir || !(dir instanceof TFolder)) {
				await this.app.vault.createFolder(dirPath).catch(() => {
					// Folder might already exist
				});
			}

			// File path: post/YYYY/MM/DD.md
			const fileName = `${String(now.getDate()).padStart(2, '0')}.md`;
			const filePath = `${dirPath}/${fileName}`;

			// Check if file exists
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			let existingContent = '';

			if (existingFile && existingFile instanceof TFile) {
				// File exists, read it
				existingContent = await this.app.vault.adapter.read(filePath);
			}

			// Format: ---\ntimestamp\ncontent\n
			const postEntry = `---\n${timestamp}\n${content}\n`;
			const newContent = existingContent ? postEntry + existingContent : postEntry;

			if (existingFile && existingFile instanceof TFile) {
				// Update existing file
				await this.app.vault.adapter.write(filePath, newContent);
			} else {
				// Create new file
				await this.app.vault.create(filePath, newContent);
			}

			return true;
		} catch (error) {
			console.error('Error creating post:', error);
			return false;
		}
	}

	async getPosts(limit?: number, offset: number = 0): Promise<{ path: string; timestamp: string; content: string }[]> {
		const posts: { path: string; timestamp: string; content: string }[] = [];
		const dir = this.app.vault.getAbstractFileByPath(this.settings.postDirectory);

		if (!dir || !(dir instanceof TFolder)) {
			return posts;
		}

		const getAllMarkdownFiles = (folder: TFolder): string[] => {
			const files: string[] = [];
			for (const file of folder.children) {
				if (file instanceof TFolder) {
					files.push(...getAllMarkdownFiles(file));
				} else if (file.name.endsWith('.md')) {
					files.push(file.path);
				}
			}
			return files;
		};

		const markdownFiles = getAllMarkdownFiles(dir);
		// Sort files by path descending (most recent first)
		markdownFiles.sort((a, b) => b.localeCompare(a));

		let postsProcessed = 0;
		let postsSkipped = 0;

		for (const filePath of markdownFiles) {
			// If we've already collected enough posts, stop
			if (limit && posts.length >= limit) {
				break;
			}

			const content = await this.app.vault.adapter.read(filePath);
			// Parse posts separated by ---
			// Format: ---\ntimestamp\ncontent\n---\n...
			const entries = content.split('---').map(s => s.trim()).filter(s => s);

			// Create temporary array for posts in this file
			const filePosts: { path: string; timestamp: string; content: string }[] = [];

			for (const entry of entries) {
				const lines = entry.split('\n');
				if (lines.length >= 2) {
					const timestamp = lines[0];
					const postContent = lines.slice(1).join('\n').trim();
					if (timestamp && postContent) {
						filePosts.push({ path: filePath, timestamp, content: postContent });
					}
				}
			}

			// Sort posts in this file by timestamp descending
			filePosts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

			// Apply offset and limit
			for (const post of filePosts) {
				if (postsSkipped < offset) {
					postsSkipped++;
					continue;
				}

				if (limit && posts.length >= limit) {
					break;
				}

				posts.push(post);
				postsProcessed++;
			}
		}

		return posts;
	}

	async deletePost(filePath: string, timestamp: string): Promise<boolean> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				return false;
			}

			const content = await this.app.vault.adapter.read(filePath);
			// Parse and remove the post with the given timestamp
			const entries = content.split('---').map(s => s.trim()).filter(s => s);
			
			const newEntries: string[] = [];
			for (const entry of entries) {
				const lines = entry.split('\n');
				if (lines.length >= 2) {
					const entryTimestamp = lines[0];
					if (entryTimestamp !== timestamp) {
						newEntries.push(entry);
					}
				}
			}

			if (newEntries.length === 0) {
				// If no posts left, delete the file
				await this.app.vault.delete(file);
			} else {
				// Reconstruct the file content
				const newContent = newEntries.map(entry => `---\n${entry}\n`).join('');
				await this.app.vault.adapter.write(filePath, newContent);
			}

			return true;
		} catch (error) {
			console.error('Error deleting post:', error);
			return false;
		}
	}
}

class ObsidianPostSettingTab extends PluginSettingTab {
	plugin: ObsidianPostPlugin;

	constructor(app: App, plugin: ObsidianPostPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Post Directory')
			.setDesc('Directory where posts will be stored (default: post)')
			.addText((text) =>
				text
					.setPlaceholder('post')
					.setValue(this.plugin.settings.postDirectory)
					.onChange(async (value) => {
						this.plugin.settings.postDirectory = value || 'post';
						await this.plugin.saveSettings();
					})
			);
	}
}
