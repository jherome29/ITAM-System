# PHASE 0 — Setup
### Goal: Get SECURITY.md into the right place before opening Claude Code
### Time: 2 minutes
### Do this: TODAY

---

## What You Need Before Starting

- [ ] SECURITY.md downloaded from the chat with Claude
- [ ] VS Code open with your `cicc/` project folder

---

## Step 0.1 — Place SECURITY.md in the project root

Your folder must look exactly like this:

```
cicc/
├── CLAUDE.md       ← already have this
├── SECURITY.md     ← ADD THIS NOW
├── START-HERE.md   ← already have this
├── docs/
├── Frontend/
├── Backend/
├── Database/
├── packages/
│   └── shared/
└── docker-compose.yml
```

**Action:** Drag SECURITY.md into the `cicc/` root folder.
Same level as CLAUDE.md. Not inside Frontend or Backend.

---

## Step 0.2 — Add one line to CLAUDE.md

Open CLAUDE.md and add this at the very top under the project title:

```
> **Security Contract:** Read SECURITY.md before implementing
> any backend feature. SECURITY.md overrides CLAUDE.md on
> all security matters.
```

---

## ✅ Checklist — confirm before moving to Phase 1

- [ ] SECURITY.md is in `cicc/` root folder (same level as CLAUDE.md)
- [ ] CLAUDE.md has the Security Contract line added at the top
- [ ] You can see CLAUDE.md and SECURITY.md side by side in VS Code

---

## Next Step

Go to `docs/phases/PHASE-1-SECURITY-AUDIT.md`
