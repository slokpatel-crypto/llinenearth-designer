import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("all Supabase SQL migrations avoid malformed function delimiters",()=>{
  const dir="supabase/migrations";
  const migrations=fs.readdirSync(dir)
    .filter((name)=>name.endsWith(".sql"))
    .sort();

  assert.ok(migrations.length>0,"expected at least one Supabase migration");

  for(const name of migrations){
    const filePath=path.join(dir,name);
    const sql=fs.readFileSync(filePath,"utf8");
    assert.equal(/^as \$$/m.test(sql),false,filePath+" contains invalid 'as $' delimiter");
    assert.equal(/^\$;$/m.test(sql),false,filePath+" contains invalid '$;' delimiter");

    const doubleDollarCount=(sql.match(/\$\$/g)||[]).length;
    assert.equal(
      doubleDollarCount%2,
      0,
      filePath+" contains an unmatched $$ function delimiter",
    );
  }
});
