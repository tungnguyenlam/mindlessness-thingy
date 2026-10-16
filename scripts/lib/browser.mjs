// Minimal headless-Chrome driver over the DevTools protocol, with no dependencies.
// Used by scripts/shot.mjs so agents can *look* at what they built (principle visual-first).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST = path.join(root, 'dist');
export const BASE = '/mindlessness-thingy';

const CHROMES = [
  process.env.CHROME,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
};

/** Serve dist/ under the deploy base, like GitHub Pages does. */
export function serveDist() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ is missing. Run `pnpm run build` first.');
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!p.startsWith(BASE)) return res.writeHead(404).end();
    p = p.slice(BASE.length) || '/';
    let file = path.join(DIST, p);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(DIST) || !fs.existsSync(file)) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function launch(flags = []) {
  const bin = CHROMES.find((c) => fs.existsSync(c));
  if (!bin) throw new Error('No Chrome/Chromium found. Set CHROME=/path/to/chrome.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-'));
  const proc = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--hide-scrollbars', ...flags, 'about:blank'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const cleanup = () => proc.kill();
  process.once('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => (cleanup(), process.exit(130)));
  return new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve({ proc, ws: m[1], dir });
    });
    proc.on('exit', (code) => reject(new Error(`Chrome exited (${code}): ${buf.slice(-400)}`)));
  });
}

class Session {
  constructor(sock, sessionId) {
    this.sock = sock;
    this.sessionId = sessionId;
  }
  send(method, params = {}) {
    return this.sock.call(method, params, this.sessionId);
  }
  once(event) {
    return this.sock.once(event, this.sessionId);
  }
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i--) {
        const w = waiters[i];
        if (w.event === msg.method && w.sessionId === msg.sessionId) {
          waiters.splice(i, 1);
          w.resolve(msg.params);
        }
      }
    }
  };
  const api = {
    call(method, params, sessionId) {
      return new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    once(event, sessionId) {
      return new Promise((resolve) => waiters.push({ event, sessionId, resolve }));
    },
    close: () => ws.close(),
  };
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(api);
    ws.onerror = reject;
  });
}

/**
 * Open a page and hand back helpers. Always closes Chrome and the server.
 * `fn({ goto, evaluate, click, wait, shot, page })`
 */
export async function withPage({ width = 1280, height = 900, flags = [] } = {}, fn) {
  const server = await serveDist();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launch(flags);
  const sock = await connect(chrome.ws);
  try {
    const { targetId } = await sock.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await sock.call('Target.attachToTarget', { targetId, flatten: true });
    const page = new Session(sock, sessionId);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const evaluate = async (expr) => {
      const r = await page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const settle = async () => {
      await evaluate('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 300)))');
    };
    const goto = async (p) => {
      const loaded = page.once('Page.loadEventFired');
      await page.send('Page.navigate', { url: origin + BASE + (p.startsWith('/') ? p : `/${p}`) });
      await loaded;
      await settle();
    };
    /** Real mouse click inside the first line box of the first element matching `selector` (scrolls it into view first). */
    const click = async (selector, { navigates = false } = {}) => {
      const box = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r0 = el.getBoundingClientRect();
        if (r0.top < 0 || r0.bottom > innerHeight) el.scrollIntoView({ block: 'center' });
        const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
        return { x: r.left + Math.min(r.width / 2, 12), y: r.top + r.height / 2 };
      })()`);
      if (!box) throw new Error(`click: nothing matches ${selector}`);
      const loaded = navigates ? page.once('Page.loadEventFired') : null;
      for (const type of ['mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      }
      if (loaded) {
        const timedOut = await Promise.race([loaded.then(() => false), wait(8000).then(() => true)]);
        if (timedOut) throw new Error(`click: ${selector} did not navigate within 8s`);
      }
      await settle();
    };
    const key = async (k) => {
      for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, text: type === 'keyDown' ? k : undefined });
    };
    const shot = async (out, { full = false } = {}) => {
      let clip;
      if (full) {
        const { cssContentSize: s } = await page.send('Page.getLayoutMetrics');
        clip = { x: 0, y: 0, width: s.width, height: Math.min(s.height, 12000), scale: 1 };
      }
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, clip });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
      return out;
    };
    return await fn({ goto, evaluate, click, key, wait, shot, page, origin });
  } finally {
    sock.close();
    chrome.proc.kill();
    await new Promise((r) => {
      if (chrome.proc.exitCode != null) r();
      else chrome.proc.once('exit', r);
    });
    server.close();
    for (let i = 0; i < 8; i++) {
      try {
        fs.rmSync(chrome.dir, { recursive: true, force: true });
        break;
      } catch (e) {
        if (e.code !== 'ENOTEMPTY' || i === 7) throw e;
        await new Promise((r) => setTimeout(r, 50 * (i + 1)));
      }
    }
  }
}
