# TITAN main intake — anonymous uncertain-write hold

Standalone, import-free copy of the fully green M147 production-write-hold helper on a small second main-intake draft stacked on the verified-receipt-parser intake PR #658. The helper persists only a random anonymous request UUID and its write epoch, blocks duplicate starts when the marker is present, retains the epoch after confirmed release, requires same-key-and-epoch snapshot equality for receipt review and rejects unavailable/corrupt browser storage. Atomic claim requires an origin-wide exclusive Web Lock; without it, no write begins. This is **library code only**, not a claim that the UI, SQL migrations, payment, stock or physical customer journey is production-ready on main.

The accompanying independent test covers reentry, wrong-key release, same UUID / changed epoch, interrupted export, malformed/inaccessible storage, and a stale snapshot under the lock.

Requirement to integrate: first merge PR #658 after its own matching-head full CI and Non-3D checks; then retarget and independently verify this exact second intake on current main with no unrelated backlog. Main must preserve git.deploymentEnabled=false and not deploy to Vercel. Never merge the multi-thousand-commit original draft stack as a shortcut.
