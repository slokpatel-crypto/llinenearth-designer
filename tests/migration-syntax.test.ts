import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Roadmap v2 SQL migrations do not contain invalid single-dollar function delimiters",()=>{
  for(const path of [
    "supabase/migrations/20261001_production_quotes_orders.sql",
    "supabase/migrations/20261002_finished_garment_qc.sql",
    "supabase/migrations/20261003_production_delivery_evidence.sql",
    "supabase/migrations/20261004_meterage_calibration_registry.sql",
    "supabase/migrations/20261005_launch_readiness_evidence.sql",
    "supabase/migrations/20261006_customer_account_ownership.sql",
    "supabase/migrations/20261007_production_customer_ownership.sql",
    "supabase/migrations/20261008_fabric_physical_color_checks.sql",
  ]){
    const sql=fs.readFileSync(path,"utf8");
    assert.equal(/^as \$$/m.test(sql),false,path+" contains invalid 'as $' delimiter");
    assert.equal(/^\$;$/m.test(sql),false,path+" contains invalid '$;' delimiter");
  }
});
