---
name: site-feature
description: Change the notebook site itself rather than its notes. Use when adding or changing a component (including a new viz component for notes), the layout, navigation, styles, client scripts, or the check tooling.
---

# Change the site

Read `PRINCIPLES.md` first. Site changes are where principles quietly break: a new component that loses its state on Back, a layout that shifts after load, a colour reused for the wrong meaning.

## 1. Understand what's there

- `src/layouts/Base.astro` wraps every page and mounts the hover previews and the return trail.
- `src/scripts/trail.ts` is the return-to-place trail (`keep-place`). Read its header comment before touching navigation, scrolling or interactive components.
- `src/components/viz/` is the visual vocabulary notes may use; `index.ts` exports it.
- `src/styles/global.css` holds the tokens. Role colours (`--role-*`) mean activation, weight, cache, route and op everywhere. `--place` (raspberry) means "the reader's place" and nothing else.
- For visual design work, also read `.agents/skills/frontend-design/SKILL.md`.

## 2. Keep the contracts

**Every page** renders inside `<Base>`. `scripts/checks/site.mjs` fails otherwise.

**Every interactive component** (anything with `customElements.define`) is restorable, so a reader who follows a link and comes back finds it as they left it:

```ts
// In the element: <x-thing data-restorable>
class XThing extends HTMLElement {
  snapshot() { return this.value === this.initial ? null : this.value; } // JSON, or null for "nothing to restore"
  restore(state: unknown) { /* may run before setup finishes: stash and apply later if so */ }
  whenReady() { return this.ready; } // only if it builds links or layout asynchronously
}
```

`Stepper.astro` is the smallest example; `GlobalGraph.astro` shows the async case. If a component truly has no state, say why in a comment: `restorable: none, <reason>`.

**Navigation** uses real `<a href>` elements. A click handler that sets `location.href` is invisible to the trail.

**Scrolling panels** carry `data-keep-scroll`.

**A new viz component** also needs a row in the Components table in `AGENTS.md` (`catalog-sync` fails otherwise), and should take its colours from the role tokens.

## 3. Verify by behaviour, not by reading

```sh
pnpm run check                      # includes the keep-place browser test, in both bfcache and reload modes
pnpm run test:place --shots         # screenshots of every step in .scratch/place/
pnpm run shot /notes/mla/ --full    # look at a page
pnpm run shot / --width 390         # and on a phone
```

If you changed something the trail test doesn't cover yet (a new interactive component, a new kind of link), extend `scripts/test-place.mjs` with a case for it. A principle that isn't tested will break.

## 4. Add a rule if you found a new way to go wrong

If your change taught you about a mistake others could make, encode it so the system catches it next time: see "Adding a rule" in `docs/guardrails.md`.

## 5. Finish

Follow `.agents/skills/finish-task/SKILL.md`. Typical messages: `feat(trail): ...`, `fix(calc): ...`, `style: ...`.
