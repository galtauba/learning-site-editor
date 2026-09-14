import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Page, Project } from "./shared/api";
import "./style.css";

const api = window.learningSite;
type Screen = "home" | "projects" | "editor" | "settings" | "media" | "git";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "The operation failed.";
const freshPage = (): Page => {
  const now = new Date().toISOString();
  return {
    sourcePath: "new-page/index.md",
    body: "# עמוד חדש\n",
    frontmatter: {
      id: crypto.randomUUID(),
      title: "עמוד חדש",
      slug: "new-page",
      published: false,
      locale: "en",
      showToc: true,
      createdAt: now,
      updatedAt: now,
    },
  };
};

function App() {
  const [screen, setScreen] = useState<Screen>("home"),
    [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project>(),
    [pages, setPages] = useState<Page[]>([]),
    [page, setPage] = useState<Page>(),
    [folders, setFolders] = useState<string[]>([]),
    [settings, setSettings] = useState<any>({}),
    [media, setMedia] = useState<{ path: string; alt?: string }[]>([]),
    [draft, setDraft] = useState<Page>(),
    [themes, setThemes] = useState<any[]>([]),
    [git, setGit] = useState<any>(),
    [notice, setNotice] = useState("מוכן."),
    [busy, setBusy] = useState(false),
    [previewActive, setPreviewActive] = useState(false),
    [updateReady, setUpdateReady] = useState(false),
    [fontScale, setFontScale] = useState(() =>
      Number(localStorage.getItem("learning-site-editor-font-scale") ?? "1"),
    ),
    [title, setTitle] = useState("My Learning Site"),
    [url, setUrl] = useState(""),
    [folder, setFolder] = useState("");
  const body = useRef<HTMLTextAreaElement>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const value = await fn();
      setNotice(typeof value === "string" ? value : "בוצע.");
      return value;
    } catch (e) {
      setNotice(errorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const refresh = async (p: Project) => {
    if (p.kind !== "current") {
      setPages([]);
      setPage(undefined);
      return;
    }
    const [
      nextPages,
      nextFolders,
      nextSettings,
      nextMedia,
      nextGit,
      nextDraft,
    ] = await Promise.all([
      api.editor.pages(p.path),
      api.editor.folders(p.path),
      api.editor.settings(p.path),
      api.editor.media(p.path) as Promise<{ path: string; alt?: string }[]>,
      api.git.projectStatus(p.path, p.autoUpdates !== false),
      api.editor.draft(p.path),
    ]);
    setPages(nextPages);
    setFolders(nextFolders);
    setSettings(nextSettings);
    setMedia(nextMedia);
    setGit(nextGit);
    setDraft(nextDraft);
    setPage(
      (current) =>
        nextPages.find((x) => x.frontmatter.id === current?.frontmatter.id) ??
        nextPages[0],
    );
  };
  const reload = async () => setProjects(await api.projects.list());
  const select = async (p: Project, target: Screen = "editor") => {
    setProject(p);
    await refresh(p);
    setScreen(p.kind === "legacy" ? "home" : target);
    return p.kind === "legacy"
      ? "Legacy project selected. Use Migrate from the dashboard."
      : `Opened ${p.name}.`;
  };
  useEffect(() => {
    void Promise.all([api.projects.list(), api.editor.themes()])
      .then(([p, t]) => {
        setProjects(p);
        setThemes(t as any[]);
      })
      .catch((e) => setNotice(errorText(e)));
  }, []);
  const save = async () => {
    if (!project || !page) throw new Error("יש לבחור עמוד תחילה.");
    const source =
      page.sourcePath.trim() ||
      `${page.frontmatter.slug || "new-page"}/index.md`;
    await api.editor.savePage(project.path, {
      ...page,
      sourcePath: source,
      frontmatter: { ...page.frontmatter, updatedAt: new Date().toISOString() },
    });
    await refresh(project);
    return "העמוד נשמר.";
  };
  const edit = (fn: (item: Page) => Page) =>
    setPage((current) => (current ? fn(current) : current));
  const insert = (start: string, end = start) => {
    if (!page) return;
    const el = body.current,
      a = el?.selectionStart ?? page.body.length,
      b = el?.selectionEnd ?? page.body.length,
      chosen = page.body.slice(a, b) || "text";
    edit((p) => ({
      ...p,
      body: p.body.slice(0, a) + start + chosen + end + p.body.slice(b),
    }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(a + start.length, a + start.length + chosen.length);
    });
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void run(save);
      }
      if (key === "n") {
        event.preventDefault();
        setPage(freshPage());
        setScreen("editor");
      }
      if (key === "p" && project?.kind === "current") {
        event.preventDefault();
        void run(() =>
          api.editor.preview(project.path).then((value) => {
            setPreviewActive(true);
            return `Preview opened: ${value}`;
          }),
        );
      }
      if (key === "b") {
        event.preventDefault();
        insert("**", "**");
      }
      if (key === "i") {
        event.preventDefault();
        insert("*", "*");
      }
      if (key === "k") {
        event.preventDefault();
        insert("[", "](https://)");
      }
      if (key === "`") {
        event.preventDefault();
        insert("`", "`");
      }
      if (key === "f") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>("[data-content-search]")
          ?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });
  const nav = (id: Screen, label: string, disabled = false) => (
    <button
      className={screen === id ? "nav active" : "nav"}
      disabled={disabled}
      onClick={() => setScreen(id)}
    >
      {label}
    </button>
  );
  const changeFontScale = (next: number) => {
    const value = Math.max(0.85, Math.min(1.35, next));
    setFontScale(value);
    localStorage.setItem("learning-site-editor-font-scale", String(value));
  };
  return (
    <main
      className="app-shell"
      dir="rtl"
      style={{ fontSize: `${fontScale}rem` }}
    >
      <header className="app-header">
        <button className="brand" onClick={() => setScreen("home")}>
          Learning Site<span>Studio</span>
        </button>
        <div className="project-name">{project?.name ?? "לא נבחר פרויקט"}</div>
        <small>{notice}</small>
        <button
          title="בדוק אם יש עדכון לעורך"
          onClick={() =>
            void run(async () => {
              const result = (await api.app.update()) as {
                state?: string;
                version?: string;
              };
              setUpdateReady(result.state === "downloaded");
              return result.state === "development"
                ? "בדיקת עדכונים זמינה במתקין בלבד."
                : result.state === "available"
                  ? `הורדת עדכון ${result.version} החלה. בדוק שוב כשהיא מסתיימת.`
                  : result.state === "downloaded"
                    ? `עדכון ${result.version} מוכן להתקנה.`
                    : "העורך מעודכן.";
            })
          }
        >
          בדוק עדכון
        </button>
        {updateReady && (
          <button
            title="התקן את העדכון שהורד"
            onClick={() =>
              void run(async () => {
                await api.app.installUpdate();
                return "העורך ייסגר כעת כדי להשלים את העדכון.";
              })
            }
          >
            התקן עדכון
          </button>
        )}
        <button
          title="Decrease interface text"
          onClick={() => changeFontScale(fontScale - 0.05)}
        >
          A−
        </button>
        <button
          title="Increase interface text"
          onClick={() => changeFontScale(fontScale + 0.05)}
        >
          A+
        </button>
      </header>
      <div className="app-body">
        <aside className="side-nav">
          {nav("home", "סקירה")}
          {nav("projects", "פרויקטים")}
          {nav("editor", "תוכן", !project || project.kind !== "current")}
          {nav(
            "settings",
            "הגדרות אתר",
            !project || project.kind !== "current",
          )}
          {nav("media", "ספריית מדיה", !project || project.kind !== "current")}
          {nav("git", "Git ועדכונים", !project)}
          <div className="side-bottom">
            <button
              disabled={busy || !project || project.kind !== "current"}
              onClick={() =>
                void run(async () => {
                  if (previewActive) {
                    await api.editor.stopPreview();
                    setPreviewActive(false);
                    return "התצוגה המקומית נעצרה.";
                  }
                  const value = await api.editor.preview(project!.path);
                  setPreviewActive(true);
                  return `Preview opened: ${value}`;
                })
              }
            >
              {previewActive ? "עצור תצוגה" : "פתח תצוגה"}
            </button>
          </div>
        </aside>
        <section className="screen">
          {screen === "home" && (
            <Home
              projects={projects}
              project={project}
              busy={busy}
              choose={(p) => void run(() => select(p))}
              migrate={() =>
                void run(async () => {
                  if (!project) throw new Error("Select a project.");
                  await api.editor.migrate(project.path);
                  const next = await api.projects.open(project.path);
                  await reload();
                  return select(next);
                })
              }
            />
          )}{" "}
          {screen === "projects" && (
            <Projects
              title={title}
              setTitle={setTitle}
              url={url}
              setUrl={setUrl}
              busy={busy}
              open={(p) => void run(() => select(p))}
              create={() =>
                void run(async () => {
                  const parent = await api.app.chooseDirectory();
                  if (!parent) return "No folder selected.";
                  const p = await api.projects.create(parent, title, "he");
                  await reload();
                  return select(p);
                })
              }
              local={() =>
                void run(async () => {
                  const path = await api.app.chooseDirectory();
                  if (!path) return "No folder selected.";
                  const p = await api.projects.open(path);
                  await reload();
                  return select(p);
                })
              }
              clone={() =>
                void run(async () => {
                  const parent = await api.app.chooseDirectory();
                  if (!parent) return "No folder selected.";
                  const name =
                    url
                      .split("/")
                      .pop()
                      ?.replace(/\.git$/i, "") || "learning-site";
                  const p = await api.projects.clone(url, `${parent}\\${name}`);
                  await reload();
                  await select(p, "git");
                  return p.state === "UNINITIALIZED"
                    ? "נוצר אתר חדש בריפו הריק. עבור ללשונית Git והזן שם ואימייל כדי ליצור commit ראשון."
                    : `Opened ${p.name}.`;
                })
              }
              importLauncher={() =>
                void run(async () => {
                  const imported = await api.projects.importLegacy();
                  await reload();
                  return `${imported.length} launcher projects imported.`;
                })
              }
            />
          )}
          {screen === "editor" && project && (
            <Editor
              page={page}
              pages={pages}
              folders={folders}
              selectedFolder={folder}
              setFolder={setFolder}
              busy={busy}
              setPage={setPage}
              edit={edit}
              insert={insert}
              bodyRef={body}
              create={() => setPage(freshPage())}
              save={() => void run(save)}
              move={(direction: "up" | "down") =>
                void run(async () => {
                  if (!page) throw new Error("Select a page.");
                  await api.editor.reorderPage(
                    project.path,
                    page.frontmatter.id,
                    direction,
                  );
                  await refresh(project);
                  return "Page order updated.";
                })
              }
              moveFolder={() =>
                void run(async () => {
                  if (!page) throw new Error("Select a page.");
                  await api.editor.movePage(
                    project.path,
                    page.sourcePath,
                    folder,
                  );
                  await refresh(project);
                  return "Page moved.";
                })
              }
              publish={(ids: string[], published: boolean) =>
                void run(async () => {
                  await api.editor.setPublication(project.path, ids, published);
                  await refresh(project);
                  return published ? "Page published." : "Page hidden.";
                })
              }
              trash={() =>
                void run(async () => {
                  if (!page) throw new Error("Select a page.");
                  await api.editor.trashPage(project.path, page.sourcePath);
                  await refresh(project);
                  return "Page moved to trash.";
                })
              }
              createFolder={(name: string) =>
                void run(async () => {
                  await api.editor.createFolder(project.path, name, folder);
                  await refresh(project);
                  return "Folder created.";
                })
              }
              renameFolder={(name: string) =>
                void run(async () => {
                  if (!folder) throw new Error("Select a folder first.");
                  await api.editor.renameFolder(project.path, folder, name);
                  setFolder("");
                  await refresh(project);
                  return "Folder renamed.";
                })
              }
              trashFolder={() =>
                void run(async () => {
                  if (!folder) throw new Error("Select a folder first.");
                  await api.editor.trashFolder(project.path, folder);
                  setFolder("");
                  await refresh(project);
                  return "Folder moved to trash.";
                })
              }
              moveSelectedFolder={(target: string) =>
                void run(async () => {
                  if (!folder) throw new Error("Select a folder first.");
                  await api.editor.moveFolder(project.path, folder, target);
                  setFolder("");
                  await refresh(project);
                  return "Folder moved.";
                })
              }
              loadTrash={() => run(() => api.editor.trashedPages(project.path))}
              restorePage={(item: string) =>
                run(async () => {
                  await api.editor.restorePage(project.path, item, folder);
                  await refresh(project);
                  return api.editor.trashedPages(project.path);
                })
              }
              loadFolderTrash={() =>
                run(() => api.editor.trashedFolders(project.path))
              }
              restoreFolder={(item: string) =>
                run(async () => {
                  await api.editor.restoreFolder(project.path, item, folder);
                  await refresh(project);
                  return api.editor.trashedFolders(project.path);
                })
              }
              draft={draft}
              restoreDraft={() => {
                if (draft) setPage(draft);
              }}
              discardDraft={() =>
                void run(async () => {
                  await api.editor.discardDraft(project.path);
                  setDraft(undefined);
                  return "Recovered draft discarded.";
                })
              }
              validate={() =>
                void run(async () =>
                  JSON.stringify(
                    await api.editor.validate(project.path),
                    null,
                    2,
                  ),
                )
              }
              build={() =>
                void run(async () => {
                  await save();
                  await api.editor.build(project.path);
                  return "Static site built.";
                })
              }
            />
          )}
          {screen === "settings" && project && (
            <Settings
              settings={settings}
              themes={themes}
              pages={pages}
              busy={busy}
              update={setSettings}
              save={() =>
                void run(async () => {
                  await api.editor.saveSettings(project.path, settings);
                  return "Site settings saved.";
                })
              }
              theme={(id: string) =>
                void run(async () => {
                  await api.editor.selectTheme(project.path, id);
                  await refresh(project);
                  return "Theme selected.";
                })
              }
              favicon={() =>
                void run(async () => {
                  await api.editor.favicon(project.path);
                  return "Favicon updated.";
                })
              }
              resetFavicon={() =>
                void run(async () => {
                  await api.editor.resetFavicon(project.path);
                  return "סמל האתר הוחזר לברירת המחדל.";
                })
              }
            />
          )}
          {screen === "media" && project && (
            <Media
              media={media}
              busy={busy}
              add={() =>
                void run(async () => {
                  const image = (await api.editor.importImage(
                    project.path,
                  )) as { path?: string } | null;
                  if (!image?.path) return "No image selected.";
                  await refresh(project);
                  return "Image added.";
                })
              }
              use={(image: { path: string; alt?: string }) =>
                page
                  ? edit((p) => ({
                      ...p,
                      body: `${p.body}${p.body.endsWith("\n") ? "" : "\n"}![${image.path}](/media/${image.path})\n`,
                    }))
                  : setNotice("בחר עמוד לפני הוספת תמונה.")
              }
              references={(path: string) =>
                run(() => api.editor.mediaReferences(project.path, path))
              }
              remove={(path: string) =>
                void run(async () => {
                  await api.editor.deleteImage(project.path, path);
                  await refresh(project);
                  return "Image deleted.";
                })
              }
            />
          )}
          {screen === "git" && project && (
            <Git
              project={project}
              status={git}
              busy={busy}
              sync={() =>
                run(async () => {
                  const result = await api.git.syncProject(
                    project.path,
                    project.autoPush !== false,
                  );
                  await refresh(project);
                  return result;
                })
              }
              history={() =>
                run(() => api.git.history(project.path).then(String))
              }
              commit={(name: string, email: string) =>
                run(async () => {
                  await api.git.identity(project.path, name, email);
                  await api.git.commit(
                    project.path,
                    "Update Learning Site content",
                  );
                  await api.git.push(project.path);
                  await refresh(project);
                  return "Changes committed and pushed.";
                })
              }
              updatePrefs={(autoPush: boolean, autoUpdates: boolean) =>
                run(async () => {
                  const next = await api.projects.updateSettings(project.id, {
                    autoPush,
                    autoUpdates,
                  });
                  setProject(next);
                  await reload();
                  return "Project preferences saved.";
                })
              }
              updateOfficial={(tag: string) =>
                run(async () => {
                  await api.git.updateProject(project.path, tag);
                  await refresh(project);
                  return `Official update ${tag} applied and pushed to your repository.`;
                })
              }
              deleteLocal={(confirmation: string) =>
                run(async () => {
                  await api.projects.delete(project.id, confirmation);
                  await reload();
                  setProject(undefined);
                  setPage(undefined);
                  setScreen("projects");
                  return "The local clone was removed. The GitHub repository was not changed.";
                })
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Home({
  projects,
  project,
  busy,
  choose,
  migrate,
}: {
  projects: Project[];
  project?: Project;
  busy: boolean;
  choose: (p: Project) => void;
  migrate: () => void;
}) {
  return (
    <>
      <div className="hero">
        <p className="eyebrow">Learning Site Studio</p>
        <h1>נהלו את האתר, כתבו שיעורים ופרסמו בבטחה.</h1>
        <p>
          סביבת העבודה מחליפה את ה־launcher ואת עורך התוכן המקוריים במסכים
          ממוקדים ופשוטים.
        </p>
      </div>
      {project?.kind === "legacy" && (
        <section className="warning">
          <h2>פרויקט בפורמט הישן</h2>
          <p>
            הפרויקט משתמש בפורמט המקורי. ההמרה יוצרת commit לשחזור לפני שינוי
            הקבצים.
          </p>
          <button className="primary" disabled={busy} onClick={migrate}>
            המר בבטחה
          </button>
        </section>
      )}
      <h2>הפרויקטים שלך</h2>
      <div className="cards">
        {projects.map((p) => (
          <button className="card" key={p.id} onClick={() => choose(p)}>
            <b>{p.name}</b>
            <span>{p.kind}</span>
            <small>{p.origin ?? p.path}</small>
          </button>
        ))}
      </div>
    </>
  );
}
function Projects({
  title,
  setTitle,
  url,
  setUrl,
  busy,
  create,
  local,
  clone,
  importLauncher,
  open,
}: {
  title: string;
  setTitle: (x: string) => void;
  url: string;
  setUrl: (x: string) => void;
  busy: boolean;
  create: () => void;
  local: () => void;
  clone: () => void;
  importLauncher: () => void;
  open: (p: Project) => void;
}) {
  const [items, setItems] = useState<Project[]>([]);
  useEffect(() => {
    void api.projects.list().then(setItems);
  }, []);
  return (
    <>
      <h1>פרויקטים</h1>
      <div className="screen-grid">
        <section className="panel">
          <h2>יצירת אתר חדש</h2>
          <label>
            שם האתר
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <button className="primary" disabled={busy} onClick={create}>
            בחר מיקום וצור
          </button>
        </section>
        <section className="panel">
          <h2>שכפול מ־GitHub</h2>
          <label>
            כתובת repository
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/you/site.git"
            />
          </label>
          <button disabled={busy || !url.trim()} onClick={clone}>
            בחר מיקום ושכפל
          </button>
        </section>
        <section className="panel">
          <h2>פתיחת פרויקט קיים</h2>
          <p>בחר repository מקומי של Learning Site שכבר קיים במחשב.</p>
          <button disabled={busy} onClick={local}>
            בחר תיקיית פרויקט
          </button>
        </section>
      </div>
      <h2>פרויקטים רשומים</h2>
      <button disabled={busy} onClick={importLauncher}>
        ייבא פרויקטים מה־launcher המקורי
      </button>
      <div className="cards">
        {items.map((p) => (
          <button className="card" key={p.id} onClick={() => open(p)}>
            <b>{p.name}</b>
            <span>{p.kind}</span>
          </button>
        ))}
      </div>
    </>
  );
}
const Editor = ({
  page,
  pages,
  folders,
  selectedFolder,
  setFolder,
  busy,
  setPage,
  edit,
  insert,
  bodyRef,
  create,
  save,
  move,
  moveFolder,
  publish,
  trash,
  createFolder,
  renameFolder,
  trashFolder,
  moveSelectedFolder,
  loadTrash,
  restorePage,
  loadFolderTrash,
  restoreFolder,
  draft,
  restoreDraft,
  discardDraft,
  validate,
  build,
}: any) => {
  const [trashItems, setTrashItems] = useState<string[]>([]),
    [folderTrashItems, setFolderTrashItems] = useState<string[]>([]),
    [folderName, setFolderName] = useState(""),
    [folderMoveTarget, setFolderMoveTarget] = useState(""),
    [pendingTrash, setPendingTrash] = useState<"page" | "folder">(),
    [selectedPageIds, setSelectedPageIds] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [detailsOpen, setDetailsOpen] = useState(true);
  const matches = (value: string) =>
    value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  if (!page)
    return (
      <section className="empty">
        <h1>לא נבחר עמוד</h1>
        <button className="primary" onClick={create}>
          צור עמוד ראשון
        </button>
      </section>
    );
  return (
    <div className="editor-screen">
      <aside className="tree">
        <input
          data-content-search
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש תוכן (Ctrl+F)"
        />
        <button className="primary" onClick={create}>
          + עמוד חדש
        </button>
        <h3>תיקיות</h3>
        <div className="folder-create">
          <input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder={selectedFolder ? "שם התיקייה החדש" : "תיקייה חדשה"}
          />
          <button
            disabled={!folderName.trim()}
            onClick={() => {
              createFolder(folderName.trim());
              setFolderName("");
            }}
          >
            הוסף
          </button>
          {selectedFolder && (
            <>
              <button
                disabled={!folderName.trim()}
                onClick={() => {
                  renameFolder(folderName.trim());
                  setFolderName("");
                }}
              >
                שנה שם
              </button>
              <button onClick={() => setPendingTrash("folder")}>
                העבר תיקייה לסל
              </button>
            </>
          )}
        </div>
        {selectedFolder && (
          <div className="folder-create">
            <select
              value={folderMoveTarget}
              onChange={(event) => setFolderMoveTarget(event.target.value)}
            >
              <option value="">תיקייה ראשית</option>
              {folders
                .filter(
                  (item: string) =>
                    item !== selectedFolder &&
                    !item.startsWith(`${selectedFolder}/`),
                )
                .map((item: string) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
            <button onClick={() => moveSelectedFolder(folderMoveTarget)}>
              העבר תיקייה
            </button>
          </div>
        )}
        <button
          className={!selectedFolder ? "active" : ""}
          onClick={() => setFolder("")}
        >
          כל התוכן
        </button>
        {folders.filter(matches).map((f: string) => (
          <button
            key={f}
            className={selectedFolder === f ? "active" : ""}
            onClick={() => setFolder(f)}
          >
            ▸ {f}
          </button>
        ))}
        <h3>עמודים</h3>
        <div className="row">
          <button
            onClick={() =>
              setSelectedPageIds(pages.map((item: Page) => item.frontmatter.id))
            }
          >
            בחר הכול
          </button>
          <button onClick={() => setSelectedPageIds([])}>נקה בחירה</button>
        </div>
        {pages
          .filter((p: Page) =>
            matches(
              `${p.frontmatter.title} ${p.frontmatter.slug} ${p.sourcePath}`,
            ),
          )
          .map((p: Page) => (
            <label
              className={
                p.frontmatter.id === page.frontmatter.id
                  ? "tree-page active"
                  : "tree-page"
              }
              key={p.frontmatter.id}
            >
              <input
                type="checkbox"
                checked={selectedPageIds.includes(p.frontmatter.id)}
                onChange={(event) =>
                  setSelectedPageIds((current) =>
                    event.target.checked
                      ? [...current, p.frontmatter.id]
                      : current.filter((id) => id !== p.frontmatter.id),
                  )
                }
              />
              <button onClick={() => setPage(p)}>
                {p.frontmatter.published ? "●" : "○"} {p.frontmatter.title}
              </button>
            </label>
          ))}
        {selectedPageIds.length > 0 && (
          <div className="row">
            <button onClick={() => publish(selectedPageIds, true)}>
              פרסם נבחרים ({selectedPageIds.length})
            </button>
            <button onClick={() => publish(selectedPageIds, false)}>
              הסר מפרסום
            </button>
          </div>
        )}
        <button
          onClick={() =>
            void loadTrash().then((items: string[]) =>
              setTrashItems(items ?? []),
            )
          }
        >
          סל עמודים ({trashItems.length || "הצג"})
        </button>
        {trashItems.map((item) => (
          <button
            key={item}
            onClick={() =>
              void restorePage(item).then((items: string[]) =>
                setTrashItems(items ?? []),
              )
            }
          >
            שחזר {item.replace(/^\d+-/, "")}
          </button>
        ))}
        <button
          onClick={() =>
            void loadFolderTrash().then((items: string[]) =>
              setFolderTrashItems(items ?? []),
            )
          }
        >
          סל תיקיות ({folderTrashItems.length || "הצג"})
        </button>
        {folderTrashItems.map((item) => (
          <button
            key={item}
            onClick={() =>
              void restoreFolder(item).then((items: string[]) =>
                setFolderTrashItems(items ?? []),
              )
            }
          >
            שחזר תיקייה {item.replace(/^\d+-/, "")}
          </button>
        ))}
      </aside>
      <article className="writing">
        <div className="row between">
          <h1>{page.frontmatter.title || "עמוד ללא כותרת"}</h1>
          <div className="row">
            <span>{page.frontmatter.published ? "מפורסם" : "טיוטה"}</span>
            <button onClick={() => setDetailsOpen((value) => !value)}>
              {detailsOpen ? "הסתר פרטי עמוד" : "הצג פרטי עמוד"}
            </button>
            {draft?.frontmatter.id === page.frontmatter.id && (
              <>
                <button onClick={restoreDraft}>שחזר טיוטת התאוששות</button>
                <button onClick={discardDraft}>מחק טיוטה</button>
              </>
            )}
          </div>
        </div>
        {detailsOpen && (
          <div className="field-row">
            <label>
              כותרת
              <input
                value={page.frontmatter.title}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: { ...p.frontmatter, title: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              Slug
              <input
                value={page.frontmatter.slug}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: { ...p.frontmatter, slug: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              קובץ התוכן
              <input
                value={page.sourcePath}
                onChange={(e) =>
                  edit((p: Page) => ({ ...p, sourcePath: e.target.value }))
                }
              />
            </label>
            <label>
              סדר תצוגה
              <input
                type="number"
                min="1"
                value={page.frontmatter.order ?? ""}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: {
                      ...p.frontmatter,
                      order: Number(e.target.value) || undefined,
                    },
                  }))
                }
              />
            </label>
            <label>
              תיאור
              <input
                value={page.frontmatter.description ?? ""}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: {
                      ...p.frontmatter,
                      description: e.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              תגיות (מופרדות בפסיק)
              <input
                value={(page.frontmatter.tags ?? []).join(", ")}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: {
                      ...p.frontmatter,
                      tags: e.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    },
                  }))
                }
              />
            </label>
            <label>
              שפה
              <select
                value={page.frontmatter.locale ?? "en"}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: { ...p.frontmatter, locale: e.target.value },
                  }))
                }
              >
                <option value="en">English</option>
                <option value="he">עברית</option>
              </select>
            </label>
            <label>
              כיוון
              <select
                value={page.frontmatter.direction ?? ""}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: {
                      ...p.frontmatter,
                      direction: e.target.value || undefined,
                    },
                  }))
                }
              >
                <option value="">לפי הגדרת השפה</option>
                <option value="ltr">משמאל לימין</option>
                <option value="rtl">מימין לשמאל</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={page.frontmatter.showToc !== false}
                onChange={(e) =>
                  edit((p: Page) => ({
                    ...p,
                    frontmatter: {
                      ...p.frontmatter,
                      showToc: e.target.checked,
                    },
                  }))
                }
              />
              הצג תוכן עניינים אוטומטי
            </label>
          </div>
        )}
        <div className="toolbar">
          <button onClick={() => insert("# ", "")}>כותרת</button>
          <button onClick={() => insert("**", "**")}>מודגש</button>
          <button onClick={() => insert("*", "*")}>נטוי</button>
          <button onClick={() => insert("- ", "")}>רשימה</button>
          <button onClick={() => insert("1. ", "")}>ממוספר</button>
          <button onClick={() => insert("> ", "")}>ציטוט</button>
          <button onClick={() => insert("[", "](https://)")}>קישור</button>
          <button onClick={() => insert("\n---\n", "")}>קו מפריד</button>
          <button onClick={() => insert(":::rtl\n", "\n:::")}>RTL</button>
          <button onClick={() => insert(":::ltr\n", "\n:::")}>LTR</button>
          <button onClick={() => insert("```mermaid\n", "\n```")}>
            Mermaid
          </button>
          <button onClick={() => insert("```\n", "\n```")}>קוד</button>
        </div>
        <textarea
          ref={bodyRef}
          dir={
            page.frontmatter.direction ??
            (page.frontmatter.locale === "he" ? "rtl" : "ltr")
          }
          value={page.body}
          onChange={(e) => edit((p: Page) => ({ ...p, body: e.target.value }))}
        />
        <div className="row">
          <button disabled={busy} onClick={() => move("up")}>
            העלה
          </button>
          <button disabled={busy} onClick={() => move("down")}>
            הורד
          </button>
          <button disabled={busy} onClick={moveFolder}>
            העבר לתיקייה הנבחרת
          </button>
          <button
            disabled={busy}
            onClick={() =>
              publish([page.frontmatter.id], !page.frontmatter.published)
            }
          >
            {page.frontmatter.published ? "הסר מפרסום" : "פרסם"}
          </button>
          <button className="primary" disabled={busy} onClick={save}>
            שמור ועדכן אתר
          </button>
          <button disabled={busy} onClick={validate}>
            בדיקת אתר
          </button>
          <button disabled={busy} onClick={build}>
            בניית אתר
          </button>
          <button disabled={busy} onClick={() => setPendingTrash("page")}>
            העבר לסל
          </button>
        </div>
        {pendingTrash && (
          <section className="warning confirm-panel">
            <b>
              {pendingTrash === "page"
                ? `להעביר את „${page.frontmatter.title}” לסל?`
                : `להעביר את התיקייה „${selectedFolder}” וכל העמודים שבה לסל?`}
            </b>
            <div className="row">
              <button onClick={() => setPendingTrash(undefined)}>ביטול</button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (pendingTrash === "page") trash();
                  else trashFolder();
                  setPendingTrash(undefined);
                }}
              >
                העבר לסל
              </button>
            </div>
          </section>
        )}
      </article>
    </div>
  );
};
const Settings = ({
  settings,
  themes,
  pages,
  busy,
  update,
  save,
  theme,
  favicon,
  resetFavicon,
}: any) => {
  const site = settings.site ?? {},
    brand = site.brand ?? {},
    homepage = site.homepage ?? {},
    texts = site.texts ?? {};
  const [navigationText, setNavigationText] = useState(
    JSON.stringify(settings.navigation ?? { items: [] }, null, 2),
  );
  useEffect(
    () =>
      setNavigationText(
        JSON.stringify(settings.navigation ?? { items: [] }, null, 2),
      ),
    [settings.navigation],
  );
  const setSite = (changes: Record<string, unknown>) =>
    update((current: any) => ({
      ...current,
      site: { ...current.site, ...changes },
    }));
  const setBrand = (changes: Record<string, unknown>) =>
    setSite({ brand: { ...brand, ...changes } });
  const setHomepage = (changes: Record<string, unknown>) =>
    setSite({ homepage: { ...homepage, ...changes } });
  const setFont = (key: string, value: string) =>
    setBrand({
      fontSizes: { ...(brand.fontSizes ?? {}), [key]: Number(value) || 0 },
    });
  const setText = (key: string, value: string) =>
    setSite({ texts: { ...texts, [key]: value } });
  return (
    <>
      <h1>הגדרות אתר</h1>
      <div className="settings-grid">
        <section className="panel">
          <h2>זהות האתר</h2>
          <label>
            כותרת האתר
            <input
              value={site.title ?? ""}
              onChange={(e) => setSite({ title: e.target.value })}
            />
          </label>
          <label>
            תיאור
            <textarea
              value={site.description ?? ""}
              onChange={(e) => setSite({ description: e.target.value })}
            />
          </label>
          <label>
            ערכת עיצוב
            <select
              value={site.theme ?? ""}
              onChange={(e) => theme(e.target.value)}
            >
              {themes.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            שפת ברירת מחדל
            <select
              value={site.defaultLocale ?? "en"}
              onChange={(e) => setSite({ defaultLocale: e.target.value })}
            >
              <option value="en">English</option>
              <option value="he">עברית</option>
            </select>
          </label>
          <label>
            כתובת האתר הציבורית
            <input
              value={site.baseUrl ?? ""}
              onChange={(e) => setSite({ baseUrl: e.target.value })}
              placeholder="https://example.com"
            />
          </label>
          <label>
            עמוד בית ברירת מחדל
            <select
              value={site.homePageId ?? ""}
              onChange={(e) =>
                setSite({ homePageId: e.target.value || undefined })
              }
            >
              <option value="">אוטומטי</option>
              {pages.map((p: Page) => (
                <option key={p.frontmatter.id} value={p.frontmatter.id}>
                  {p.frontmatter.title}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="panel">
          <h2>מיתוג</h2>
          {["prefix", "accent", "tagline"].map((key) => (
            <label key={key}>
              {key}
              <input
                value={brand[key] ?? ""}
                onChange={(e) => setBrand({ [key]: e.target.value })}
              />
            </label>
          ))}
          {[
            ["homeLabel", "Home label"],
            ["menuLabel", "Menu label"],
            ["lightLabel", "Light-mode label"],
            ["darkLabel", "Dark-mode label"],
            ["headerIconPath", "Header icon path"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={brand[key] ?? ""}
                onChange={(e) => setBrand({ [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={brand.navigationExpanded !== false}
              onChange={(e) =>
                setBrand({ navigationExpanded: e.target.checked })
              }
            />{" "}
            Keep navigation expanded
          </label>
        </section>
        <section className="panel">
          <h2>עמוד הבית</h2>
          {["title", "description"].map((key) => (
            <label key={key}>
              {key}
              <input
                value={homepage[key] ?? ""}
                onChange={(e) => setHomepage({ [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            פעיל
            <input
              type="checkbox"
              checked={homepage.enabled !== false}
              onChange={(e) => setHomepage({ enabled: e.target.checked })}
            />
          </label>
          <label>
            עמוד התחל כאן
            <select
              value={homepage.startPageId ?? ""}
              onChange={(e) =>
                setHomepage({ startPageId: e.target.value || undefined })
              }
            >
              <option value="">העמוד המפורסם הראשון</option>
              {pages.map((p: Page) => (
                <option key={p.frontmatter.id} value={p.frontmatter.id}>
                  {p.frontmatter.title}
                </option>
              ))}
            </select>
          </label>
          {[
            ["showCategories", "Show categories"],
            ["showPageCounts", "Show page counts"],
            ["showFeatured", "Show featured pages"],
          ].map(([key, label]) => (
            <label className="checkbox-label" key={key}>
              <input
                type="checkbox"
                checked={homepage[key] !== false}
                onChange={(e) => setHomepage({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <h3>עמודים מומלצים</h3>
          {pages.map((p: Page) => (
            <label className="checkbox-label" key={p.frontmatter.id}>
              <input
                type="checkbox"
                checked={(homepage.featuredPageIds ?? []).includes(
                  p.frontmatter.id,
                )}
                onChange={(e) =>
                  setHomepage({
                    featuredPageIds: e.target.checked
                      ? [...(homepage.featuredPageIds ?? []), p.frontmatter.id]
                      : (homepage.featuredPageIds ?? []).filter(
                          (id: string) => id !== p.frontmatter.id,
                        ),
                  })
                }
              />
              {p.frontmatter.title}
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>גדלי פונטים</h2>
          {[
            ["body", "Body"],
            ["h1", "Heading 1"],
            ["h2", "Heading 2"],
            ["h3", "Heading 3"],
            ["sidebar", "Sidebar"],
            ["sidebarHeading", "Sidebar heading"],
            ["sidebarSpacing", "Sidebar spacing"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                value={brand.fontSizes?.[key] ?? ""}
                onChange={(e) => setFont(key, e.target.value)}
              />
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>טקסטים מתקדמים באתר</h2>
          <p>
            הטקסטים האלו נשמרים בתצורת האתר ונכתבים גם ל־site-texts.json, כמו
            בעורך Python.
          </p>
          {[
            ["learning_path_label", "כותרת מסלול הלמידה"],
            ["navigation_label", "תיאור נגיש לתפריט"],
            ["loading_content", "הודעת טעינת תכנים"],
            ["page_count", "מונה עמודים ({count})"],
            ["empty_title", "כותרת ללא תכנים"],
            ["empty_description", "הודעה ללא תכנים"],
            ["loading_page", "הודעת טעינת עמוד"],
            ["load_error_title", "כותרת שגיאת טעינה"],
            ["load_error_description", "תיאור שגיאת טעינה ({file})"],
            ["missing_index_title", "כותרת אינדקס חסר"],
            ["missing_index_description", "הודעת אינדקס חסר"],
            ["homepage_start_label", "כפתור התחלה בדף הבית"],
            ["homepage_categories_title", "כותרת קטגוריות בדף הבית"],
            ["homepage_featured_title", "כותרת מומלצים בדף הבית"],
            ["homepage_page_count", "מונה דף הבית ({count})"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={texts[key] ?? ""}
                onChange={(event) => setText(key, event.target.value)}
              />
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>נתוני ניווט</h2>
          <p>
            ערוך את התפריט המקונן בפורמט JSON. הנתונים יחולו כשתצא מהשדה ורק אם
            הם תקינים.
          </p>
          <textarea
            className="json-editor"
            value={navigationText}
            onChange={(e) => setNavigationText(e.target.value)}
            onBlur={() => {
              try {
                const navigation = JSON.parse(navigationText);
                if (!Array.isArray(navigation.items)) throw new Error();
                update((current: any) => ({ ...current, navigation }));
              } catch {
                setNavigationText(
                  JSON.stringify(settings.navigation ?? { items: [] }, null, 2),
                );
              }
            }}
          />
        </section>
      </div>
      <button disabled={busy} onClick={favicon}>
        בחר סמל אתר
      </button>
      <button disabled={busy} onClick={resetFavicon}>
        החזר סמל לברירת המחדל
      </button>
      <button className="primary" disabled={busy} onClick={save}>
        שמור הגדרות אתר
      </button>
    </>
  );
};
const Media = ({ media, busy, add, use, references, remove }: any) => {
  const [usedBy, setUsedBy] = useState<Record<string, string[]>>({});
  return (
    <>
      <div className="row between">
        <h1>ספריית מדיה</h1>
        <button className="primary" disabled={busy} onClick={add}>
          הוסף תמונה
        </button>
      </div>
      <div className="cards">
        {media.length ? (
          media.map((m: any) => (
            <section className="card" key={m.path}>
              <b>{m.path}</b>
              <small>{m.alt ?? "ללא טקסט חלופי"}</small>
              <div className="row">
                <button onClick={() => use(m)}>הוסף לעמוד</button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void references(m.path).then((pages: string[]) =>
                      setUsedBy((current) => ({
                        ...current,
                        [m.path]: pages ?? [],
                      })),
                    )
                  }
                >
                  בדוק שימושים
                </button>
                <button disabled={busy} onClick={() => remove(m.path)}>
                  מחק
                </button>
              </div>
              {usedBy[m.path] && (
                <small>
                  {usedBy[m.path].length
                    ? `בשימוש בעמודים: ${usedBy[m.path].join(", ")}`
                    : "התמונה אינה בשימוש."}
                </small>
              )}
            </section>
          ))
        ) : (
          <p>עדיין אין תמונות.</p>
        )}
      </div>
    </>
  );
};
const Git = ({
  project,
  status,
  busy,
  sync,
  history,
  commit,
  updatePrefs,
  updateOfficial,
  deleteLocal,
}: any) => {
  const [log, setLog] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [confirmation, setConfirmation] = useState("");
  return (
    <>
      <h1>Git ועדכונים</h1>
      <section className="panel">
        <dl>
          <dt>ענף</dt>
          <dd>{status?.branch ?? "—"}</dd>
          <dt>Origin</dt>
          <dd>{status?.origin ?? "—"}</dd>
          <dt>מקור רשמי</dt>
          <dd>{status?.upstream ?? "לא הוגדר"}</dd>
          <dt>שינויים</dt>
          <dd>
            {status
              ? `${status.ahead} ahead · ${status.behind} behind`
              : "Checking…"}
          </dd>
          <dt>מצב</dt>
          <dd>
            {status?.state ?? "Checking…"}
            {status?.dirty ? " — uncommitted changes" : ""}
          </dd>
          <dt>גרסה רשמית</dt>
          <dd>
            {status?.installedVersion ?? "ללא תגית"}
            {status?.latestVersion ? ` · האחרונה ${status.latestVersion}` : ""}
          </dd>
        </dl>
        <div className="row">
          <button
            className="primary"
            disabled={busy || status?.state === "UNINITIALIZED"}
            onClick={sync}
          >
            סנכרן פרויקט
          </button>
          <button
            disabled={busy}
            onClick={async () => setLog(String((await history()) ?? ""))}
          >
            הצג היסטוריה
          </button>
        </div>
        {status?.state === "UNINITIALIZED" && (
          <section className="warning">
            <b>repository חדש — טרם נוצר commit ראשון</b>
            <p>
              נוצרו בו קבצי Learning Site החדשים בלבד. הזן שם ואימייל למטה ולחץ
              על יצירת ה־commit הראשון; הפעולה תדחוף אותו ל־origin שלך.
            </p>
          </section>
        )}
        {status?.state === "UPSTREAM_UPDATE_AVAILABLE" &&
          status.latestVersion && (
            <section className="warning">
              <b>זמין עדכון רשמי: {status.latestVersion}</b>
              <p>
                לפני העדכון נוצר checkpoint לשחזור; בסיום הפרויקט נשלח ל־origin
                שלך.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => updateOfficial(status.latestVersion)}
              >
                התקן עדכון רשמי
              </button>
            </section>
          )}
        <h2>
          {status?.state === "UNINITIALIZED"
            ? "יצירת אתר ו־commit ראשוני"
            : "Commit ופרסום"}
        </h2>
        <label>
          שם ב־Git
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="השם שלך"
          />
        </label>
        <label>
          אימייל ב־Git
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <button
          disabled={busy || !name.trim() || !email.trim()}
          onClick={() => commit(name.trim(), email.trim())}
        >
          {status?.state === "UNINITIALIZED"
            ? "צור ודחוף commit ראשוני"
            : "צור commit ושלח"}
        </button>
        <h2>העדפות פרויקט</h2>
        <label>
          שליחה אוטומטית
          <input
            type="checkbox"
            defaultChecked={project.autoPush !== false}
            onChange={(event) =>
              updatePrefs(event.target.checked, project.autoUpdates !== false)
            }
          />
        </label>
        <label>
          בדיקת עדכונים רשמיים
          <input
            type="checkbox"
            defaultChecked={project.autoUpdates !== false}
            onChange={(event) =>
              updatePrefs(project.autoPush !== false, event.target.checked)
            }
          />
        </label>
        {log && <pre>{log}</pre>}
      </section>
      <section className="panel danger-zone">
        <h2>הסר את ה־clone המקומי</h2>
        <p>
          הפעולה מוחקת רק את התיקייה במחשב הזה. ה־repository ב־GitHub נשאר ללא
          שינוי.
        </p>
        <label>
          הקלד <b>{project.name}</b> לאישור
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <button
          className="danger"
          disabled={busy || confirmation !== project.name}
          onClick={() => deleteLocal(confirmation)}
        >
          הסר clone מקומי
        </button>
      </section>
    </>
  );
};
createRoot(document.getElementById("root")!).render(<App />);
