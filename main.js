let obsidian = require("obsidian");

//#region src/components/PostInput.ts
var PostInput = class {
	constructor(plugin, container, onPostCreated) {
		this.plugin = plugin;
		this.container = container;
		this.onPostCreated = onPostCreated;
		this.render();
	}
	render() {
		this.container.empty();
		const inputContainer = this.container.createEl("div", { attr: { style: "padding: 12px; border-bottom: 1px solid var(--color-base-30); background-color: var(--color-base-20);" } });
		const textarea = inputContainer.createEl("textarea", { attr: {
			placeholder: "What's on your mind?",
			style: "width: 100%; height: 100px; padding: 8px; font-family: inherit; border: 1px solid var(--color-base-30); border-radius: 4px; resize: none;"
		} });
		inputContainer.createEl("div", { attr: { style: "display: flex; gap: 8px; margin-top: 8px;" } }).createEl("button", {
			text: "Post",
			attr: { style: "flex: 1; padding: 8px; cursor: pointer;" }
		}).addEventListener("click", async () => {
			const content = textarea.value.trim();
			if (content) {
				await this.plugin.createPost(content);
				textarea.value = "";
				await this.onPostCreated();
			}
		});
		textarea.addEventListener("keydown", async (e) => {
			if (e.ctrlKey && e.key === "Enter") {
				const content = textarea.value.trim();
				if (content) {
					await this.plugin.createPost(content);
					textarea.value = "";
					await this.onPostCreated();
				}
			}
		});
		textarea.focus();
	}
};

//#endregion
//#region src/views/PostView.ts
const VIEW_TYPE_POST = "obsidian-post-view";
const henkan = Intl.DateTimeFormat(void 0, {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit"
});
var PostView = class extends obsidian.ItemView {
	constructor(leaf, plugin) {
		super(leaf);
		this.postInput = null;
		this.postsContainer = null;
		this.loadedPosts = 0;
		this.postsPerPage = 20;
		this.isLoading = false;
		this.hasMorePosts = true;
		this.plugin = plugin;
	}
	getViewType() {
		return VIEW_TYPE_POST;
	}
	getDisplayText() {
		return "Posts";
	}
	async onOpen() {
		await this.refreshPosts();
	}
	async onClose() {}
	async refreshPosts() {
		const container = this.contentEl;
		container.empty();
		container.createEl("div", { attr: { style: "border-bottom: 1px solid var(--color-base-30);" } }).createEl("h2", {
			text: "Posts",
			attr: { style: "padding: 12px; margin: 0;" }
		});
		const inputContainer = container.createEl("div");
		this.postInput = new PostInput(this.plugin, inputContainer, () => this.resetAndRefreshPosts());
		this.postsContainer = container.createEl("div", { attr: { style: "padding: 12px; max-height: calc(100% - 250px); overflow-y: auto;" } });
		this.postsContainer.addEventListener("scroll", () => {
			const { scrollTop, scrollHeight, clientHeight } = this.postsContainer;
			if (scrollHeight - scrollTop - clientHeight < 200 && !this.isLoading && this.hasMorePosts) this.loadMorePosts();
		});
		this.loadedPosts = 0;
		this.hasMorePosts = true;
		await this.loadMorePosts();
	}
	async resetAndRefreshPosts() {
		this.loadedPosts = 0;
		this.hasMorePosts = true;
		if (this.postsContainer) this.postsContainer.empty();
		await this.loadMorePosts();
	}
	async loadMorePosts() {
		if (this.isLoading || !this.hasMorePosts || !this.postsContainer) return;
		this.isLoading = true;
		const posts = await this.plugin.getPosts(this.postsPerPage, this.loadedPosts);
		if (posts.length === 0) {
			this.hasMorePosts = false;
			if (this.loadedPosts === 0) this.postsContainer.createEl("p", {
				text: "No posts yet. Create your first post!",
				attr: { style: "color: var(--text-muted);" }
			});
			this.isLoading = false;
			return;
		}
		if (posts.length < this.postsPerPage) this.hasMorePosts = false;
		this.loadedPosts += posts.length;
		this.renderPosts(posts);
		this.isLoading = false;
	}
	renderPosts(posts) {
		if (!this.postsContainer) return;
		for (const post of posts) {
			const postItem = this.postsContainer.createEl("div", { attr: { style: "padding: 12px; margin-bottom: 8px; border: 1px solid var(--color-base-30); border-radius: 4px; cursor: pointer; transition: background-color 0.2s;" } });
			postItem.addEventListener("mouseover", () => {
				postItem.style.backgroundColor = "var(--color-base-25)";
			});
			postItem.addEventListener("mouseout", () => {
				postItem.style.backgroundColor = "transparent";
			});
			const headerDiv = postItem.createEl("div", { attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;" } });
			headerDiv.createEl("div", {
				attr: { style: "font-weight: bold; color: var(--text-muted); font-size: 0.9em;" },
				text: henkan.format(new Date(post.timestamp))
			});
			headerDiv.createEl("button", {
				text: "✕",
				attr: { style: "background-color: var(--color-base-25); border: none; color: var(--text-normal); cursor: pointer; padding: 2px 6px; border-radius: 2px; font-size: 0.9em;" }
			}).addEventListener("click", async (e) => {
				e.stopPropagation();
				if (confirm("この投稿を削除しますか？")) {
					await this.plugin.deletePost(post.path, post.timestamp);
					await this.resetAndRefreshPosts();
				}
			});
			const preview = post.content.substring(0, 200).replace(/\n/g, " ");
			postItem.createEl("p", {
				text: preview + (post.content.length > 200 ? "..." : ""),
				attr: { style: "margin: 4px 0; color: var(--text-normal); font-size: 0.95em; line-height: 1.4;" }
			});
			postItem.addEventListener("click", async () => {
				await this.app.workspace.openLinkText(post.path, "");
			});
		}
	}
};

//#endregion
//#region src/main.ts
const DEFAULT_SETTINGS = { postDirectory: "post" };
var ObsidianPostPlugin = class extends obsidian.Plugin {
	async onload() {
		await this.loadSettings();
		this.registerView(VIEW_TYPE_POST, (leaf) => new PostView(leaf, this));
		this.addRibbonIcon("pencil", "Open Posts", () => {
			this.activatePostsView();
		});
		this.addCommand({
			id: "obsidian-post:open-posts",
			name: "Open Posts View",
			callback: () => {
				this.activatePostsView();
			}
		});
		this.addSettingTab(new ObsidianPostSettingTab(this.app, this));
		this.registerMarkdownCodeBlockProcessor("postinput", (source, el, ctx) => {
			if (el.empty) el.empty();
			else el.innerHTML = "";
			const container = el.createEl("div");
			container.addClass("obsidian-postinput-container");
			new PostInput(this, container, async () => {
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_POST);
				if (leaves.length > 0 && leaves[0].view && leaves[0].view.resetAndRefreshPosts) await leaves[0].view.resetAndRefreshPosts();
			});
		});
	}
	onunload() {}
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}
	async activatePostsView() {
		const { workspace } = this.app;
		let leaf = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_POST);
		if (leaves.length > 0) leaf = leaves[0];
		else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) await leaf.setViewState({
				type: VIEW_TYPE_POST,
				active: true
			});
		}
		if (leaf) workspace.revealLeaf(leaf);
	}
	async createPost(content) {
		try {
			const now = /* @__PURE__ */ new Date();
			const timestamp = now.toISOString();
			const dirPath = `${this.settings.postDirectory}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
			const dir = this.app.vault.getAbstractFileByPath(dirPath);
			if (!dir || !(dir instanceof obsidian.TFolder)) await this.app.vault.createFolder(dirPath).catch(() => {});
			const filePath = `${dirPath}/${`${String(now.getDate()).padStart(2, "0")}.md`}`;
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			let existingContent = "";
			if (existingFile && existingFile instanceof obsidian.TFile) existingContent = await this.app.vault.adapter.read(filePath);
			const postEntry = `---\n${timestamp}\n${content}\n`;
			const newContent = existingContent ? postEntry + existingContent : postEntry;
			if (existingFile && existingFile instanceof obsidian.TFile) await this.app.vault.adapter.write(filePath, newContent);
			else await this.app.vault.create(filePath, newContent);
			return true;
		} catch (error) {
			console.error("Error creating post:", error);
			return false;
		}
	}
	async getPosts(limit, offset = 0) {
		const posts = [];
		const dir = this.app.vault.getAbstractFileByPath(this.settings.postDirectory);
		if (!dir || !(dir instanceof obsidian.TFolder)) return posts;
		const getAllMarkdownFiles = (folder) => {
			const files = [];
			for (const file of folder.children) if (file instanceof obsidian.TFolder) files.push(...getAllMarkdownFiles(file));
			else if (file.name.endsWith(".md")) files.push(file.path);
			return files;
		};
		const markdownFiles = getAllMarkdownFiles(dir);
		markdownFiles.sort((a, b) => b.localeCompare(a));
		let postsProcessed = 0;
		let postsSkipped = 0;
		for (const filePath of markdownFiles) {
			if (limit && posts.length >= limit) break;
			const entries = (await this.app.vault.adapter.read(filePath)).split("---").map((s) => s.trim()).filter((s) => s);
			const filePosts = [];
			for (const entry of entries) {
				const lines = entry.split("\n");
				if (lines.length >= 2) {
					const timestamp = lines[0];
					const postContent = lines.slice(1).join("\n").trim();
					if (timestamp && postContent) filePosts.push({
						path: filePath,
						timestamp,
						content: postContent
					});
				}
			}
			filePosts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
			for (const post of filePosts) {
				if (postsSkipped < offset) {
					postsSkipped++;
					continue;
				}
				if (limit && posts.length >= limit) break;
				posts.push(post);
				postsProcessed++;
			}
		}
		return posts;
	}
	async deletePost(filePath, timestamp) {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof obsidian.TFile)) return false;
			const entries = (await this.app.vault.adapter.read(filePath)).split("---").map((s) => s.trim()).filter((s) => s);
			const newEntries = [];
			for (const entry of entries) {
				const lines = entry.split("\n");
				if (lines.length >= 2) {
					if (lines[0] !== timestamp) newEntries.push(entry);
				}
			}
			if (newEntries.length === 0) await this.app.vault.delete(file);
			else {
				const newContent = newEntries.map((entry) => `---\n${entry}\n`).join("");
				await this.app.vault.adapter.write(filePath, newContent);
			}
			return true;
		} catch (error) {
			console.error("Error deleting post:", error);
			return false;
		}
	}
};
var ObsidianPostSettingTab = class extends obsidian.PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display() {
		const { containerEl } = this;
		containerEl.empty();
		new obsidian.Setting(containerEl).setName("Post Directory").setDesc("Directory where posts will be stored (default: post)").addText((text) => text.setPlaceholder("post").setValue(this.plugin.settings.postDirectory).onChange(async (value) => {
			this.plugin.settings.postDirectory = value || "post";
			await this.plugin.saveSettings();
		}));
	}
};

//#endregion
module.exports = ObsidianPostPlugin;