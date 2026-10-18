#!/usr/bin/env python3
"""Regenerate src/data/tokenizer-samples.json: how each tokenizer in src/content/tokenizers/ splits a
fixed set of sample texts, stage by stage, plus its chat format rendered on one short conversation.

Everything here is computed from the released tokenizer files (tokenizer.json, chat template), so
the page shows what the tokenizer really does rather than a hand-typed guess. Run it after adding
a tokenizer or changing SAMPLES:

    python3 scripts/tokenizer-samples.py            # needs: pip install tokenizers jinja2

Files are downloaded once into .scratch/tokenizers/.
"""
import json
import pathlib
import re
import urllib.request

import jinja2
import jinja2.ext
import jinja2.nodes
import tokenizers
from jinja2.sandbox import ImmutableSandboxedEnvironment
from tokenizers import Tokenizer, pre_tokenizers

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / '.scratch' / 'tokenizers'
OUT = ROOT / 'src' / 'data' / 'tokenizer-samples.json'
HF = 'https://huggingface.co/{repo}/resolve/main/{file}'

# id (matches src/content/tokenizers/<id>.yaml) → the repo whose files define it.
TOKENIZERS = {
    'deepseek-v2': {'repo': 'deepseek-ai/DeepSeek-V2', 'chat': ('tokenizer_config.json', 'chat_template')},
    'deepseek-v3': {'repo': 'deepseek-ai/DeepSeek-V3', 'chat': ('tokenizer_config.json', 'chat_template')},
    'lfm2': {'repo': 'LiquidAI/LFM2.5-1.2B-Instruct', 'chat': ('chat_template.jinja', None)},
    'lfm2-5-128k': {'repo': 'LiquidAI/LFM2.5-2.6B', 'chat': ('chat_template.jinja', None)},
    'minicpm-v-4-7': {'repo': 'openbmb/MiniCPM-V-4.7-35B-A3B', 'chat': ('tokenizer_config.json', 'chat_template')},
}

# Short on purpose: each one has to fit on a phone screen as a row of token chips.
SAMPLES = [
    {'id': 'english', 'label': 'English', 'text': 'The quick brown fox jumps over the lazy dog.'},
    {'id': 'numbers', 'label': 'Numbers', 'text': 'In 2024, 1234567 tokens cost $3.14.'},
    {'id': 'code', 'label': 'Code', 'text': 'def add(a, b):\n    return a + b\n'},
    {'id': 'json', 'label': 'JSON', 'text': '{"name": "Ada", "tags": ["x", "y"]}'},
    {'id': 'lines', 'label': 'Line breaks', 'text': 'Q: 2+2?\nA: 4.\nQ: 3+5?\n'},
    {'id': 'chinese', 'label': 'Chinese', 'text': '深度求索发布了新的语言模型。'},
    {'id': 'japanese', 'label': 'Japanese', 'text': '東京は日本の首都です。'},
    {'id': 'vietnamese', 'label': 'Vietnamese', 'text': 'Mô hình ngôn ngữ học từ dữ liệu.'},
]

# Pairs where the second tokenizer followed the first: how much of the older vocabulary survives.
RELATIONS = [('deepseek-v2', 'deepseek-v3'), ('lfm2', 'lfm2-5-128k')]

CONVERSATION = [
    {'role': 'system', 'content': 'Be brief.'},
    {'role': 'user', 'content': 'What is 2+2?'},
    {'role': 'assistant', 'content': '4'},
]


def fetch(repo, file):
    path = CACHE / repo.replace('/', '_') / file
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(HF.format(repo=repo, file=file), path)
    return path


def split_only(spec):
    """The pre-tokenizer without its ByteLevel step: the chunks BPE never merges across."""
    pt = spec.get('pre_tokenizer') or {}
    steps = []
    for p in pt.get('pretokenizers', []):
        if p['type'] == 'Split':
            steps.append(pre_tokenizers.Split(tokenizers.Regex(p['pattern']['Regex']), p['behavior'].lower(), invert=p['invert']))
        elif p['type'] == 'Digits':
            steps.append(pre_tokenizers.Digits(individual_digits=p['individual_digits']))
    return pre_tokenizers.Sequence(steps) if steps else None


def byte_decoder():
    """Inverse of the byte-level alphabet (GPT-2): each of the 256 bytes is drawn as one printable
    character, so 'Ġ' is a space byte. Used to get every token's exact bytes."""
    bs = list(range(ord('!'), ord('~') + 1)) + list(range(ord('¡'), ord('¬') + 1)) + list(range(ord('®'), ord('ÿ') + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return {chr(c): b for b, c in zip(bs, cs)}


BYTES = byte_decoder()


def chips(ids, raw):
    """Group tokens into displayable chips. A token can end in the middle of a multi-byte character
    (common for Vietnamese or rare CJK); those tokens are grouped with the next until the bytes decode,
    and the chip records that it holds several tokens split inside a character."""
    out, buf, group = [], b'', []
    for i, r in zip(ids, raw):
        b = bytes(BYTES[c] for c in r)
        group.append([i, b.hex()])
        buf += b
        try:
            text = buf.decode('utf-8')
        except UnicodeDecodeError:
            continue
        out.append({'text': text, 'ids': [g[0] for g in group], 'bytes': [g[1] for g in group]} if len(group) > 1 else {'text': text, 'ids': [i]})
        buf, group = b'', []
    if group:
        out.append({'text': buf.decode('utf-8', 'replace'), 'ids': [g[0] for g in group], 'bytes': [g[1] for g in group]})
    return out


class Generation(jinja2.ext.Extension):
    """{% generation %}...{% endgeneration %} marks assistant text for training masks (a
    transformers extension); for rendering it is a no-op."""

    tags = {'generation'}

    def parse(self, parser):
        lineno = next(parser.stream).lineno
        body = parser.parse_statements(('name:endgeneration',), drop_needle=True)
        return jinja2.nodes.Scope(body, lineno=lineno)


def render_chat(template):
    env = ImmutableSandboxedEnvironment(trim_blocks=True, lstrip_blocks=True, extensions=['jinja2.ext.loopcontrols', Generation])
    env.filters['tojson'] = lambda x, **kw: json.dumps(x, ensure_ascii=False, **kw)

    def raise_exception(msg):
        raise jinja2.exceptions.TemplateError(msg)

    env.globals['raise_exception'] = raise_exception
    return env.from_string(template)


def main():
    out = {'generator': f'scripts/tokenizer-samples.py with tokenizers {tokenizers.__version__}', 'samples': SAMPLES, 'tokenizers': {}}
    for tid, cfg in TOKENIZERS.items():
        repo = cfg['repo']
        tj = fetch(repo, 'tokenizer.json')
        spec = json.loads(tj.read_text())
        tok = Tokenizer.from_file(str(tj))
        splitter = split_only(spec)
        # Every added token (special or not, e.g. DeepSeek's <｜User｜>) is a control token no text produces.
        specials = {a['content'] for a in spec.get('added_tokens', [])}
        rows = {}
        for s in SAMPLES:
            enc = tok.encode(s['text'], add_special_tokens=False)
            pieces = [p for p, _ in splitter.pre_tokenize_str(s['text'])] if splitter else [s['text']]
            byte_pieces = [p for p, _ in tok.pre_tokenizer.pre_tokenize_str(s['text'])]
            rows[s['id']] = {
                'pieces': pieces,
                'bytePieces': byte_pieces,
                'count': len(enc.ids),
                'chips': chips(enc.ids, enc.tokens),
            }
        # Chat format: the template's own output on the same conversation, split into special
        # tokens and text so the page can colour the special ones.
        file, key = cfg['chat']
        chat = None
        try:
            src = fetch(repo, file).read_text()
            template = json.loads(src)[key] if key else src
            tc = json.loads(fetch(repo, 'tokenizer_config.json').read_text())
            name = lambda t: t['content'] if isinstance(t, dict) else t
            text = render_chat(template).render(messages=CONVERSATION, bos_token=name(tc.get('bos_token')), eos_token=name(tc.get('eos_token')), add_generation_prompt=False)
            pattern = '(' + '|'.join(re.escape(t) for t in sorted(specials, key=len, reverse=True)) + ')'
            parts = [p for p in re.split(pattern, text) if p]
            chat = {'source': f'{repo}/{file}', 'parts': [[p in specials, p] for p in parts], 'tokens': len(tok.encode(text, add_special_tokens=False).ids)}
        except Exception as e:  # a template we can't render is left out, not guessed
            print(f'{tid}: chat template not rendered: {e}')
        out['tokenizers'][tid] = {'repo': repo, 'samples': rows, 'chat': chat}
        print(f'{tid}: ' + ', '.join(f"{k} {v['count']}" for k, v in rows.items()))
    out['relations'] = []
    for a, b in RELATIONS:
        ma = json.loads(fetch(TOKENIZERS[a]['repo'], 'tokenizer.json').read_text())['model']
        mb = json.loads(fetch(TOKENIZERS[b]['repo'], 'tokenizer.json').read_text())['model']
        merges_b = {str(x) for x in mb['merges']}
        out['relations'].append({
            'from': a,
            'to': b,
            'baseTokens': len(ma['vocab']),
            'tokensKept': sum(1 for k in ma['vocab'] if k in mb['vocab']),
            'sameId': sum(1 for k, i in ma['vocab'].items() if mb['vocab'].get(k) == i),
            'merges': len(ma['merges']),
            'mergesKept': sum(1 for x in ma['merges'] if str(x) in merges_b),
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print(f'wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
