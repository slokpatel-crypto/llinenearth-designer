const PRIMARY_PROJECT_ID = "prj_b3rwwOl5OI0VV3qYyKXPFOloCllT";
const current = process.env.VERCEL_PROJECT_ID;

if (!current) {
  console.log("VERCEL_PROJECT_ID unavailable; continue build.");
  process.exit(1);
}

if (current === PRIMARY_PROJECT_ID) {
  console.log("Primary Linen Earth web project; continue build.");
  process.exit(1);
}

console.log(`Duplicate Vercel project ${current}; ignore this Git-triggered build.`);
process.exit(0);
