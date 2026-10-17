// Turn a model value into what a table cell shows: text, optional link, and its provenance
// (source + where, inherited from a parent, or derived with a formula).
import { DERIVED, formatDerived, derivedSources } from './data.mjs';
import { FIELD, FIELDS, GROUPS, formatValue } from './fields.mjs';
import { noteUrl } from '../url';
import type { modelData } from './load';

type Data = Awaited<ReturnType<typeof modelData>>;

export interface Cell {
  text: string;
  /** Raw value for comparing across models. */
  raw: string;
  href?: string;
  /** Note slug the link points to (for hover previews). */
  slug?: string;
  sources: { short: string; url: string; title: string; where?: string }[];
  inheritedFrom?: string;
  formula?: string;
  derived?: boolean;
}

export interface RowDef {
  key: string;
  label: string;
  group: string;
  derived: boolean;
  concept?: string;
}

export const ROWS: RowDef[] = [
  ...FIELDS.map((f) => ({ key: f.key, label: f.label, group: f.group, derived: false, concept: f.concept })),
  // Derived-only rows; a key that is also a field (head_dim) shares the field's row and falls back
  // to the derived value when the model doesn't state it.
  ...DERIVED.filter((f) => !FIELD[f.key]).map((f) => ({ key: f.key, label: f.label, group: f.group, derived: true, concept: f.concept })),
];

export const GROUP_ORDER = GROUPS;

export function cell(d: Data, model: any, row: RowDef): Cell | null {
  const src = (id: string, where?: string) => {
    const s = d.sources.get(id);
    return { short: s?.short ?? id, url: s?.url ?? '#', title: s?.title ?? id, where };
  };
  const v = model.values[row.key];
  if (v) {
    const f = FIELD[row.key];
    // slug → the note's title; tokenizer → the tokenizer's title, linking to its note when it has one.
    const tok = f.kind === 'tokenizer' ? d.tokenizers.get(v.v) : null;
    const target = f.kind === 'slug' ? v.v : tok?.note;
    const text = f.kind === 'slug' ? (d.notes.get(v.v)?.title ?? String(v.v)) : tok ? tok.title : formatValue(f, v);
    return {
      text,
      raw: String(v.v),
      href: target && d.notes.has(target) ? noteUrl(target) : undefined,
      slug: target && d.notes.has(target) ? target : undefined,
      sources: [src(v.source, v.where)],
      inheritedFrom: v.inherited ? v.from : undefined,
    };
  }
  const dv = model.derived[row.key];
  if (!dv) return null;
  const def = DERIVED.find((x) => x.key === row.key)!;
  return {
    text: formatDerived(def, dv.v),
    raw: String(dv.v),
    sources: derivedSources(model, row.key).map((id: string) => src(id)),
    formula: dv.formula,
    derived: true,
  };
}

export const conceptHref = (d: Data, slug?: string) => (slug && d.notes.has(slug) ? noteUrl(slug) : undefined);
