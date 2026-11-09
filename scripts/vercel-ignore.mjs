const PRIMARY_PROJECT_ID = "prj_b3rwwOl5OI0VV3qYyKXPFOloCllT";
const PRODUCTION_BRANCH = "main";
const APPROVED_PREVIEW_BRANCHES = new Set(["work/anthropic-knowledge-harvest-20261013-v1", "fix/garment-viewer-identity-honesty-20261015"]);
// Only an explicit commit-subject prefix authorizes a milestone build.
// Mentioning [deploy] later in an ordinary message is not release approval.
const DEPLOY_MARKER = /^\[deploy\](?:\s|$)/i;

// Vercel ignoreCommand: exit 0 skips the build; exit 1 allows it.
// Unknown deployment metadata must never serve as implicit approval.
const current = process.env.VERCEL_PROJECT_ID;
const branch = process.env.VERCEL_GIT_COMMIT_REF;
const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE;
const environment = process.env.VERCEL_ENV;

if (!current) {
  console.log("VERCEL_PROJECT_ID unavailable; ignore build without a verified project.");
  process.exit(0);
}

if (current !== PRIMARY_PROJECT_ID) {
  console.log(`Duplicate Vercel project ${current}; ignore this Git-triggered build.`);
  process.exit(0);
}

// Allow only explicitly named review branches to build as protected previews.
// This never authorizes production deployment.
if (branch && APPROVED_PREVIEW_BRANCHES.has(branch) && environment === "preview") {
  console.log(`Approved protected preview branch ${branch}; continue preview build.`);
  process.exit(1);
}

if (branch && branch !== PRODUCTION_BRANCH) {
  console.log(`Primary project preview branch ${branch}; ignore to preserve production build quota.`);
  process.exit(0);
}

if (!branch) {
  console.log("VERCEL_GIT_COMMIT_REF unavailable; ignore build without a verified branch.");
  process.exit(0);
}

if (environment !== "production") {
  console.log("Primary main branch requires VERCEL_ENV=production; ignore unverified build environment.");
  process.exit(0);
}

if (typeof commitMessage !== "string" || !commitMessage.trim()) {
  console.log("VERCEL_GIT_COMMIT_MESSAGE unavailable on main; ignore build without milestone evidence.");
  process.exit(0);
}

if (!DEPLOY_MARKER.test(commitMessage.trim())) {
  console.log("Primary main commit has no [deploy] milestone marker; ignore automatic production build.");
  process.exit(0);
}

console.log("Primary Linen Earth main milestone marked [deploy]; continue production build.");
process.exit(1);
