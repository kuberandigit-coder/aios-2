# Capabilities — 2026-09-04

## Capability — Self-Service "Create User" for the Dev Role

**Date:** 2026-09-04
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Live

### Capability

A dev can create a new username/password directly from the dashboard, and that user immediately
becomes available everywhere else (e.g. User Access Management) with zero extra wiring — no
separate admin step or redeploy needed to onboard a new staff login.

### Originating task

`closure/dm-dashboard/2026-09-04_sajeepan-port-and-historical-data-import.md`

### Reuse

The standing way to onboard any future staff member's dashboard login.

---

## Capability — Root-Cause CSS Debugging Checklist (unstyled-form bug class)

**Date:** 2026-09-04
**Owner:** Kuberan (Thivajini's Feed Optimization page)
**Status:** Fixed

### Capability

A reusable short checklist for diagnosing a page that renders with broken/unstyled form elements:
check for (1) wrong or nonexistent CSS class names, (2) missing wrapper `<div>`s the CSS selectors
depend on, (3) missing `type="text"` (or other type) attributes on inputs that change how a
browser's default styling applies. Root-caused and fixed properly rather than patched
superficially.

### Originating task

`closure/dm-dashboard/2026-09-04_thivajini-port-and-mahima-investigation.md`
