const PRIMARY_PROJECT_ID = "prj_b3rwwOl5OI0VV3qYyKXPFOloCllT";
const PRODUCTION_BRANCH = "main";
const ANTHROPIC_PREVIEW_BRANCH = "work/anthropic-knowledge-harvest-20261013-v1";
const DEPLOY_MARKER = "[deploy]";

const current = process.env.VERCEL_PROJECT_ID;
const branch = process.env.VERCEL_GIT_COMMIT_REF;
const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE;
const environment = process.env.VERCEL_ENV;

if (!current) {
  console.log("VERCEL_PROJECT_ID unavailable; continue build fail-safe.");
  process.exit(1);
}

if (current !== PRIMARY_PROJECT_ID) {
  console.log(`Duplicate Vercel project ${current}; ignore this Git-triggered build.`);
  process.exit(0);
}

// Allow only the explicitly named Anthropic integration branch to build as a
// protected preview in the primary project. This never authorizes production.
if (branch === ANTHROPIC_PREVIEW_BRANCH && environment === "preview") {
  console.log("Approved Anthropic integration preview; continue protected preview build.");
  process.exit(1);
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
