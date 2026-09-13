import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject, createProject, validateProject } from "../../learning-site-engine/src/index.ts";
import { loadPages, savePage } from "../../learning-site-engine/src/content.ts";

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
describe("Engine-backed editor workflow",()=>{
 it("creates, saves, validates, and generates the public site",async()=>{
  const root=await mkdtemp(join(tmpdir(),"learning-site-editor-"));roots.push(root);
  await createProject(root,{title:"Science",locale:"en"});
  const now=new Date().toISOString();
  await savePage(root,{sourcePath:"physics/index.md",body:"# Motion\nA lesson about movement.",frontmatter:{id:"physics",title:"Motion",slug:"physics",published:true,locale:"en",createdAt:now,updatedAt:now}});
  expect((await loadPages(root)).map(page=>page.frontmatter.slug)).toEqual(["physics"]);
  expect(await validateProject(root)).toMatchObject({valid:true});
  const built=await buildProject(root,"production");
  expect(built.files).toContain("index.html");
  expect(await readFile(join(root,"public","physics","index.html"),"utf8")).toContain("Motion");
  expect(await readFile(join(root,"public","build-manifest.json"),"utf8")).toContain("production");
 });
});
