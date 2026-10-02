const PRIMARY_PROJECT_ID = "prj_b3rwwOl5OI0VV3qYyKXPFOloCllT";
const PRODUCTION_BRANCH = "main";

const current = process.env.VERCEL_PROJECT_ID;
const branch = process.env.VERCEL_GIT_COMMIT_REF;

if (!current) {
  console.log("VERCEL_PROJECT_ID unavailable; continue build fail-safe.");
  process.exit(1);
}

if (current !== PRIMARY_PROJECT_ID) {
  console.log(`Duplicate Vercel project ${current}; ignore this Git-triggered build.`);
  process.exit(0);
}

if (branch && branch !== PRODUCTION_BRANCH) {
  console.log(`Primary project preview branch ${branch}; ignore to preserve production build quota.`);
  process.exit(0);
}

if (!branch) {
  console.log("VERCEL_GIT_COMMIT_REF unavailable; continue build fail-safe.");
  process.exit(1);
}

console.log("Primary Linen Earth main branch; continue production build.");
process.exit(1);
