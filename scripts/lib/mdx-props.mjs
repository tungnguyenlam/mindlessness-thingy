// Pull the props of viz components out of MDX without compiling it, so checks can lint diagrams,
// specs and comparisons in well under a second. Props in notes are literals (strings, numbers,
// arrays, objects), which is what makes this possible; an expression that isn't a literal is
// reported as `error` on the usage instead of being silently skipped.
import vm from 'node:vm';

/** Find the end of a balanced {...} expression starting at src[i] === '{'. */
function readExpr(src, i) {
  let depth = 0;
  let quote = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === '\\') j++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j;
  }
  return -1;
}

/**
 * @param {string} text  note body with comments blanked (note.text)
 * @param {string[]} names  component names to find
 * @returns {{ name, props, line, error? }[]}  line is relative to the body (1-based)
 */
export function findComponents(text, names) {
  const masked = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));
  const out = [];
  const re = new RegExp(`<(${names.join('|')})(?=[\\s/>])`, 'g');
  for (const m of masked.matchAll(re)) {
    const use = { name: m[1], props: {}, line: masked.slice(0, m.index).split('\n').length };
    let i = m.index + m[0].length;
    while (i < masked.length) {
      while (/\s/.test(masked[i])) i++;
      if (masked.startsWith('/>', i) || masked[i] === '>') break;
      const nm = masked.slice(i).match(/^[A-Za-z_][\w-]*/);
      if (!nm) {
        use.error = `can't parse attributes near "${masked.slice(i, i + 20)}"`;
        break;
      }
      i += nm[0].length;
      if (masked[i] !== '=') {
        use.props[nm[0]] = true;
        continue;
      }
      i++;
      if (masked[i] === '"' || masked[i] === "'") {
        const end = masked.indexOf(masked[i], i + 1);
        use.props[nm[0]] = masked.slice(i + 1, end);
        i = end + 1;
      } else if (masked[i] === '{') {
        const end = readExpr(masked, i);
        if (end < 0) {
          use.error = `unbalanced braces in ${nm[0]}`;
          break;
        }
        const expr = masked.slice(i + 1, end);
        try {
          use.props[nm[0]] = vm.runInNewContext(`(${expr})`, Object.create(null), { timeout: 50 });
        } catch (e) {
          use.error = `prop ${nm[0]} is not a literal (${e.message.split('\n')[0]})`;
        }
        i = end + 1;
      } else {
        use.error = `can't parse value of ${nm[0]}`;
        break;
      }
    }
    // Where the usage ends: after "/>", or after the matching closing tag for components with children.
    if (masked.startsWith('/>', i)) use.end = i + 2;
    else if (masked[i] === '>') {
      const close = masked.indexOf(`</${m[1]}>`, i);
      use.end = close < 0 ? i + 1 : close + m[1].length + 3;
    } else use.end = i;
    use.start = m.index;
    out.push(use);
  }
  return out;
}

/**
 * The note's text with every listed component replaced by a one-line marker, so prose can be
 * measured without counting captions and table rows. Line count is preserved.
 */
export function maskComponents(text, names, marker = '\u0000VISUAL\u0000') {
  const uses = findComponents(text, names).filter((u) => u.end).sort((a, b) => b.start - a.start);
  let out = text;
  for (const u of uses) {
    const chunk = out.slice(u.start, u.end);
    out = out.slice(0, u.start) + marker + '\n'.repeat(chunk.split('\n').length - 1) + out.slice(u.end);
  }
  return out;
}
