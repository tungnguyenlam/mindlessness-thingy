// Site-level contracts that keep principles true as the code grows.
// Rules: keep-place (PRINCIPLES.md#keep-place) and catalog-sync.
import { RULES } from '../rules.mjs';

export default function site({ list, read, exists }, { error }) {
  // Every page renders inside Base, which mounts the return-to-place ribbon.
  for (const page of list('src/pages', '.astro')) {
    if (!/import\s+Base\s+from\s+['"][./]*layouts\/Base\.astro['"]/.test(read(page))) {
      error('keep-place', page, 'page does not render inside layouts/Base.astro', 'wrap the page in <Base>; Base mounts the trail ribbon and hover previews every page needs');
    }
  }
  const base = 'src/layouts/Base.astro';
  const baseSrc = read(base);
  if (!/initTrail\(\)/.test(baseSrc) || !/id="trail"/.test(baseSrc)) {
    error('keep-place', base, 'Base no longer mounts the trail (#trail + initTrail())', 'restore them; see src/scripts/trail.ts');
  }

  // Interactive components must survive a round trip: their state is part of "the exact place".
  for (const file of list('src/components', '.astro')) {
    const src = read(file);
    if (!/customElements\.define\(/.test(src)) continue;
    if (/restorable:\s*none/.test(src)) continue;
    const missing = ['data-restorable', 'snapshot(', 'restore('].filter((s) => !src.includes(s));
    if (missing.length) {
      error(
        'keep-place',
        file,
        `interactive component is not restorable (missing ${missing.join(', ')})`,
        'add data-restorable to the element and implement snapshot()/restore(state) (see Stepper.astro); if it truly has no state, add a comment "restorable: none, <reason>"',
      );
    }
  }

  // The component catalog in AGENTS.md is what agents read; it must list every viz component.
  const agents = read('AGENTS.md');
  const index = read('src/components/viz/index.ts');
  const exported = index.match(/vizComponents\s*=\s*\{([^}]*)\}/)?.[1].split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  for (const name of exported) {
    if (!agents.includes(`<${name}>`)) error('catalog-sync', 'AGENTS.md', `component <${name}> is exported for notes but missing from the catalog table`, `add a row for <${name}> under ## Components`);
  }

  // Every rule id must be written down where its doc pointer says.
  for (const [id, rule] of Object.entries(RULES)) {
    const file = rule.doc.split('#')[0];
    if (!exists(file)) error('catalog-sync', 'scripts/rules.mjs', `rule ${id} points to missing ${file}`);
    else if (!read(file).includes(`\`${id}\``)) error('catalog-sync', file, `rule \`${id}\` is enforced but not documented here`, `mention \`${id}\` in ${rule.doc}`);
  }
}
