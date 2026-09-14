export type ProjectKind = "current" | "legacy" | "unsupported";
export interface Project {
  id: string;
  path: string;
  name: string;
  kind: ProjectKind;
  lastOpened: string;
  origin?: string;
  upstream?: string;
  branch?: string;
  currentVersion?: string;
  lastSync?: string;
  autoUpdates?: boolean;
  autoPush?: boolean;
  trusted?: boolean;
  state?: string;
}
export interface PageFrontmatter {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  locale?: string;
  description?: string;
  tags?: string[];
  showToc?: boolean;
  direction?: "ltr" | "rtl";
  order?: number;
  createdAt: string;
  updatedAt: string;
}
export interface Page {
  sourcePath: string;
  body: string;
  frontmatter: PageFrontmatter;
}
export type GitProjectStatus = {
  branch: string;
  origin?: string;
  upstream?: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  installedVersion?: string;
  latestVersion?: string;
  state: string;
};
export interface AppApi {
  projects: {
    list(): Promise<Project[]>;
    create(path: string, title: string, locale: "en" | "he"): Promise<Project>;
    open(path: string): Promise<Project>;
    remove(id: string): Promise<void>;
    updateSettings(
      id: string,
      changes: { autoUpdates?: boolean; autoPush?: boolean; trusted?: boolean },
    ): Promise<Project>;
    delete(id: string, confirmation: string): Promise<void>;
    clone(url: string, destination: string): Promise<Project>;
    importLegacy(): Promise<Project[]>;
  };
  editor: {
    pages(root: string): Promise<Page[]>;
    draft(root: string): Promise<Page | undefined>;
    saveDraft(root: string, page: Page): Promise<void>;
    discardDraft(root: string): Promise<void>;
    savePage(root: string, page: Page): Promise<void>;
    deletePage(root: string, sourcePath: string): Promise<void>;
    settings(root: string): Promise<Record<string, unknown>>;
    saveSettings(
      root: string,
      settings: Record<string, unknown>,
    ): Promise<void>;
    validate(root: string): Promise<unknown>;
    build(root: string): Promise<unknown>;
    migrate(root: string): Promise<unknown>;
    themes(): Promise<unknown[]>;
    selectTheme(root: string, id: string): Promise<void>;
    media(root: string): Promise<unknown[]>;
    importImage(root: string): Promise<unknown>;
    deleteImage(root: string, path: string, force?: boolean): Promise<void>;
    mediaReferences(root: string, path: string): Promise<string[]>;
    favicon(root: string): Promise<void>;
    resetFavicon(root: string): Promise<void>;
    preview(root: string): Promise<string>;
    stopPreview(): Promise<boolean>;
    folders(root: string): Promise<string[]>;
    createFolder(root: string, name: string, parent?: string): Promise<string>;
    renameFolder(root: string, from: string, to: string): Promise<string>;
    moveFolder(
      root: string,
      sourcePath: string,
      targetFolder?: string,
    ): Promise<string>;
    movePage(
      root: string,
      sourcePath: string,
      target?: string,
    ): Promise<string>;
    setPublication(
      root: string,
      ids: string[],
      published: boolean,
    ): Promise<Page[]>;
    reorderPage(
      root: string,
      id: string,
      direction: "up" | "down",
    ): Promise<Page[]>;
    trashPage(root: string, sourcePath: string): Promise<string>;
    trashedPages(root: string): Promise<string[]>;
    restorePage(
      root: string,
      trashName: string,
      targetFolder?: string,
    ): Promise<string>;
    trashFolder(root: string, folderPath: string): Promise<string>;
    trashedFolders(root: string): Promise<string[]>;
    restoreFolder(
      root: string,
      trashName: string,
      targetFolder?: string,
    ): Promise<string>;
  };
  git: {
    status(root: string): Promise<unknown>;
    projectStatus(
      root: string,
      checkOfficialUpdates?: boolean,
    ): Promise<GitProjectStatus>;
    syncProject(root: string, push?: boolean): Promise<string>;
    updateProject(root: string, tag: string): Promise<GitProjectStatus>;
    init(root: string): Promise<void>;
    sync(root: string): Promise<void>;
    commit(root: string, message: string): Promise<void>;
    push(root: string): Promise<void>;
    history(root: string): Promise<unknown>;
    identity(root: string, name: string, email: string): Promise<void>;
  } & ((root: string, args: unknown[]) => Promise<unknown>);
  app: {
    version(): Promise<string>;
    update(): Promise<unknown>;
    installUpdate(): Promise<void>;
    chooseDirectory(): Promise<string | undefined>;
    openExternal(url: string): Promise<void>;
  };
}
declare global {
  interface Window {
    learningSite: AppApi;
  }
}
