# claude instructions for this repo

## fork-only pull requests

this repository is **lassebenni/kahoot-alternative**, a fork of **supabase-community/kahoot-alternative**.

**never open pull requests against the parent/upstream repo** (`supabase-community/kahoot-alternative`). all PRs, merges, and deploys target the fork only.

- `origin` = fork (`lassebenni/kahoot-alternative`) — push here, PR here
- `upstream` = parent (`supabase-community/kahoot-alternative`) — reference only, no PRs

when using `gh`:

```bash
gh pr create --repo lassebenni/kahoot-alternative
```

production deploy: merge to `main` on the fork → GitHub Actions deploys to Cloudflare Pages (`hyf-live-qa`).
