import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("electron",()=>({app:{getPath:()=>tmpdir(),isPackaged:false,getAppPath:()=>process.cwd()},dialog:{},shell:{}}));
import { createProject } from "../../learning-site-engine/src/project.ts";
import { loadPages } from "../../learning-site-engine/src/content.ts";
import { savePage } from "../electron/services.ts";

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
describe("page movement",()=>{
 it("removes the old source file when a page is moved by changing its slug",async()=>{
  const root=await mkdtemp(join(tmpdir(),"learning-site-move-"));roots.push(root);await createProject(root);
  const now=new Date().toISOString(),frontmatter={id:"lesson",title:"Lesson",slug:"first",published:false,createdAt:now,updatedAt:now};
  await savePage(root,{sourcePath:"first/index.md",body:"# Lesson",frontmatter});
  await savePage(root,{sourcePath:"folder/lesson/index.md",body:"# Lesson",frontmatter:{...frontmatter,slug:"folder/lesson",updatedAt:new Date().toISOString()}});
  expect((await loadPages(root)).map(page=>page.sourcePath.replace(/\\/g,"/"))).toEqual(["folder/lesson/index.md"]);
 });
});
