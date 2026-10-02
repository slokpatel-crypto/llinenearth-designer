import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("SQL migrations do not contain literal escaped newline separators",()=>{
  const dir=path.join(process.cwd(),"supabase","migrations");
  const files=fs.readdirSync(dir).filter((name)=>name.endsWith(".sql")).sort();
  const broken:string[]=[];
  for(const file of files){
    const content=fs.readFileSync(path.join(dir,file),"utf8");
    if(content.includes("\\n")) broken.push(file);
  }
  assert.deepEqual(broken,[],`Literal \\n tokens found in SQL migrations: ${broken.join(", ")}`);
});
