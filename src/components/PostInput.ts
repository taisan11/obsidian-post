import ObsidianPostPlugin from '../main';

export class PostInput {
	private plugin: ObsidianPostPlugin;
	private container: HTMLElement;
	private onPostCreated: () => Promise<void>;

	constructor(
		plugin: ObsidianPostPlugin,
		container: HTMLElement,
		onPostCreated: () => Promise<void>
	) {
		this.plugin = plugin;
		this.container = container;
		this.onPostCreated = onPostCreated;
		this.render();
	}

	private render() {
		this.container.empty();

		const inputContainer = this.container.createEl('div', {
			attr: {
				style:
					'padding: 12px; border-bottom: 1px solid var(--color-base-30); background-color: var(--color-base-20);',
			},
		});

		const textarea = inputContainer.createEl('textarea', {
			attr: {
				placeholder: "What's on your mind?",
				style:
					'width: 100%; height: 100px; padding: 8px; font-family: inherit; border: 1px solid var(--color-base-30); border-radius: 4px; resize: none;',
			},
		});

		const buttonContainer = inputContainer.createEl('div', {
			attr: { style: 'display: flex; gap: 8px; margin-top: 8px;' },
		});

		const postButton = buttonContainer.createEl('button', {
			text: 'Post',
			attr: { style: 'flex: 1; padding: 8px; cursor: pointer;' },
		});

		postButton.addEventListener('click', async () => {
			const content = textarea.value.trim();
			if (content) {
				await this.plugin.createPost(content);
				textarea.value = '';
				await this.onPostCreated();
			}
		});

		// Allow Ctrl+Enter to submit
		textarea.addEventListener('keydown', async (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === 'Enter') {
				const content = textarea.value.trim();
				if (content) {
					await this.plugin.createPost(content);
					textarea.value = '';
					await this.onPostCreated();
				}
			}
		});

		// Focus on textarea
		textarea.focus();
	}
}
