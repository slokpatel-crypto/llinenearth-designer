const PRIMARY_PROJECT_ID = "prj_b3rwwOl5OI0VV3qYyKXPFOloCllT";
const PRODUCTION_BRANCH = "main";
const DEPLOY_MARKER = "[deploy]";

const current = process.env.VERCEL_PROJECT_ID;
const branch = process.env.VERCEL_GIT_COMMIT_REF;
const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE;

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

if (typeof commitMessage !== "string" || !commitMessage.trim()) {
  console.log("VERCEL_GIT_COMMIT_MESSAGE unavailable on main; continue build fail-safe.");
  process.exit(1);
}

if (!commitMessage.toLowerCase().includes(DEPLOY_MARKER)) {
  console.log("Primary main commit has no [deploy] milestone marker; ignore automatic production build.");
  process.exit(0);
}

console.log("Primary Linen Earth main milestone marked [deploy]; continue production build.");
process.exit(1);
