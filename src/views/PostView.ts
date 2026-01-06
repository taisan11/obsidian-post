import {
	ItemView,
	WorkspaceLeaf,
	TFolder,
	Modal,
	App,
} from 'obsidian';
import ObsidianPostPlugin from '../main';
import { PostInput } from '../components/PostInput';

export const VIEW_TYPE_POST = 'obsidian-post-view';

// Use the runtime locale so dates are formatted according to the user's environment
const henkan = Intl.DateTimeFormat(undefined, {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
});

export class PostView extends ItemView {
	plugin: ObsidianPostPlugin;
	postInput: PostInput | null = null;
	postsContainer: HTMLElement | null = null;
	loadedPosts: number = 0;
	postsPerPage: number = 20;
	isLoading: boolean = false;
	hasMorePosts: boolean = true;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianPostPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_POST;
	}

	getDisplayText() {
		return 'Posts';
	}

	async onOpen() {
		await this.refreshPosts();
	}

	async onClose() {
		// Nothing to clean up
	}

	async refreshPosts() {
		const container = this.contentEl;
		container.empty();

		const header = container.createEl('div', {
			attr: { style: 'border-bottom: 1px solid var(--color-base-30);' },
		});

		header.createEl('h2', {
			text: 'Posts',
			attr: { style: 'padding: 12px; margin: 0;' },
		});

		// PostInput component
		const inputContainer = container.createEl('div');
		this.postInput = new PostInput(this.plugin, inputContainer, () =>
			this.resetAndRefreshPosts()
		);

		// Posts list container
		this.postsContainer = container.createEl('div', {
			attr: {
				style:
					'padding: 12px; max-height: calc(100% - 250px); overflow-y: auto;',
			},
		});

		// Add scroll event listener for infinite scroll
		this.postsContainer.addEventListener('scroll', () => {
			const { scrollTop, scrollHeight, clientHeight } = this.postsContainer!;
			// Load more when scrolled to within 200px of bottom
			if (scrollHeight - scrollTop - clientHeight < 200 && !this.isLoading && this.hasMorePosts) {
				this.loadMorePosts();
			}
		});

		// Reset and load initial posts
		this.loadedPosts = 0;
		this.hasMorePosts = true;
		await this.loadMorePosts();
	}

	public async resetAndRefreshPosts() {
		this.loadedPosts = 0;
		this.hasMorePosts = true;
		if (this.postsContainer) {
			this.postsContainer.empty();
		}
		await this.loadMorePosts();
	}

	private async loadMorePosts() {
		if (this.isLoading || !this.hasMorePosts || !this.postsContainer) return;

		this.isLoading = true;

		const posts = await this.plugin.getPosts(this.postsPerPage, this.loadedPosts);

		if (posts.length === 0) {
			this.hasMorePosts = false;
			if (this.loadedPosts === 0) {
				this.postsContainer.createEl('p', {
					text: 'No posts yet. Create your first post!',
					attr: { style: 'color: var(--text-muted);' },
				});
			}
			this.isLoading = false;
			return;
		}

		if (posts.length < this.postsPerPage) {
			this.hasMorePosts = false;
		}

		this.loadedPosts += posts.length;

		this.renderPosts(posts);

		this.isLoading = false;
	}

	private renderPosts(posts: { path: string; timestamp: string; content: string }[]) {
		if (!this.postsContainer) return;

		for (const post of posts) {
			const postItem = this.postsContainer.createEl('div', {
				attr: {
					style:
						'padding: 12px; margin-bottom: 8px; border: 1px solid var(--color-base-30); border-radius: 4px; cursor: pointer; transition: background-color 0.2s;',
				},
			});

			postItem.addEventListener('mouseover', () => {
				postItem.style.backgroundColor = 'var(--color-base-25)';
			});

			postItem.addEventListener('mouseout', () => {
				postItem.style.backgroundColor = 'transparent';
			});

			// Create header with timestamp and delete button
			const headerDiv = postItem.createEl('div', {
				attr: {
					style:
						'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;',
				},
			});

			headerDiv.createEl('div', {
				attr: {
					style:
						'font-weight: bold; color: var(--text-muted); font-size: 0.9em;',
				},
				text: henkan.format(new Date(post.timestamp)),
			});

			const deleteBtn = headerDiv.createEl('button', {
				text: '✕',
				attr: {
					style:
						'background-color: var(--color-base-25); border: none; color: var(--text-normal); cursor: pointer; padding: 2px 6px; border-radius: 2px; font-size: 0.9em;',
				},
			});

			deleteBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				if (confirm('この投稿を削除しますか？')) {
					await this.plugin.deletePost(post.path, post.timestamp);
					await this.resetAndRefreshPosts();
				}
			});

			// Display post content
			const preview = post.content.substring(0, 200).replace(/\n/g, ' ');
			postItem.createEl('p', {
				text: preview + (post.content.length > 200 ? '...' : ''),
				attr: {
					style:
						'margin: 4px 0; color: var(--text-normal); font-size: 0.95em; line-height: 1.4;',
				},
			});

			postItem.addEventListener('click', async () => {
				await this.app.workspace.openLinkText(post.path, '');
			});
		}
	}
}

class PostModal extends Modal {
	plugin: ObsidianPostPlugin;
	postContent: string = '';

	constructor(app: App, plugin: ObsidianPostPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'New Post' });

		const inputContainer = contentEl.createEl('div');
		const textarea = inputContainer.createEl('textarea', {
			attr: {
				placeholder: "What's on your mind?",
				style:
					'width: 100%; height: 150px; padding: 8px; font-family: monospace; border: 1px solid var(--color-base-30); border-radius: 4px;',
			},
		});

		textarea.addEventListener('input', (e) => {
			this.postContent = (e.target as HTMLTextAreaElement).value;
		});

		const buttonContainer = contentEl.createEl('div', {
			attr: { style: 'margin-top: 16px; display: flex; gap: 8px;' },
		});

		const postButton = buttonContainer.createEl('button', {
			text: 'Post',
			attr: { style: 'flex: 1; padding: 8px;' },
		});

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			attr: { style: 'flex: 1; padding: 8px;' },
		});

		postButton.addEventListener('click', async () => {
			if (this.postContent.trim()) {
				await this.plugin.createPost(this.postContent);
				this.close();
				// Refresh the view if it's open
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_POST);
				if (leaves.length > 0 && leaves[0].view instanceof PostView) {
					await (leaves[0].view as PostView).refreshPosts();
				}
			}
		});

		cancelButton.addEventListener('click', () => {
			this.close();
		});

		// Focus on textarea
		textarea.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
