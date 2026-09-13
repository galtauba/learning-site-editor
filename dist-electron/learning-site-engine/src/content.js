import { join } from "node:path";
import { files, text, writeText } from "./fs.js";
import { ValidationError } from "./errors.js";
const FRONT = /^---\n([\s\S]*?)\n---\n?/, heading = /^#\s+(.+)$/m;
export function slugify(value) { const out = value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""); return out || "page"; }
export function parsePage(sourcePath, raw) { const match = raw.match(FRONT); if (!match)
    throw new ValidationError("Page is missing frontmatter", { sourcePath }); let front; try {
    front = JSON.parse(match[1] ?? "");
}
catch {
    throw new ValidationError("Page frontmatter must be JSON", { sourcePath });
} if (!front || typeof front !== "object")
    throw new ValidationError("Invalid page frontmatter", { sourcePath }); return { frontmatter: front, body: raw.slice(match[0].length), sourcePath }; }
export function serializePage(page) { return `---\n${JSON.stringify(page.frontmatter, null, 2)}\n---\n${page.body.trim()}\n`; }
export async function loadPages(root) { const base = join(root, "content"); const names = (await files(base)).filter(p => p.endsWith(".md")).sort(); return Promise.all(names.map(async (name) => parsePage(name, await text(join(base, name))))); }
export async function savePage(root, page) { const rel = page.sourcePath || `${page.frontmatter.slug}/index.md`; if (rel.includes(".."))
    throw new ValidationError("Unsafe page source path", { rel }); await writeText(join(root, "content", rel), serializePage(page)); }
export function markdownHtml(markdown) { const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); const inline = (s) => escape(s).replace(/!\[([^\]]*)\]\(([^ )]+)\)/g, '<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\((https?:\/\/[^ )]+|\/[^ )]*)\)/g, '<a href="$2">$1</a>').replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"); const lines = markdown.split(/\r?\n/); let html = "", list = false, code = false; for (const line of lines) {
    if (line.startsWith("```")) {
        code = !code;
        html += code ? "<pre><code>" : "</code></pre>";
        continue;
    }
    if (code) {
        html += escape(line) + "\n";
        continue;
    }
    const h = line.match(/^(#{1,6})\s+(.+)/);
    if (h) {
        if (list) {
            html += "</ul>";
            list = false;
        }
        const hashes = h[1], headingText = h[2];
        const n = hashes.length;
        html += `<h${n}>${inline(headingText)}</h${n}>`;
        continue;
    }
    if (/^[-*]\s+/.test(line)) {
        if (!list) {
            html += "<ul>";
            list = true;
        }
        html += `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`;
        continue;
    }
    if (list) {
        html += "</ul>";
        list = false;
    }
    if (line.trim())
        html += `<p>${inline(line)}</p>`;
} return html + (list ? "</ul>" : ""); }
export function pageOutputPath(page) { return page.frontmatter.slug === "" ? "index.html" : `${page.frontmatter.slug}/index.html`; }
