# 04 — Fix Stray `C:\c\` Theme Folder Path

**Date:** 18/06/2026 · **Status:** Done

## Problem
The theme was pulled into a stray folder `C:\c\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk` instead of the real Desktop. Cause: using **Git Bash** path syntax `/c/Users/...` inside **PowerShell**, where a leading `/` means "root of current drive" → created a literal `C:\c\` folder.

## Fix
- Located theme (intact): `C:\Users\PC\vintagelite-couk` (a botched `Move-Item` without `-Destination` had moved it to the current dir).
- Moved correctly: `Move-Item -Path "C:\Users\PC\vintagelite-couk" -Destination "C:\Users\PC\OneDrive\Desktop\shopify\"`.
- Removed stray `C:\c`.

## Final location
`C:\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk`

## Key learning
In **PowerShell** use `C:\...` paths, never `/c/...` (that's Git Bash only). Always pass `-Destination` to `Move-Item`.
