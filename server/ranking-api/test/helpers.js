import { once } from 'node:events';

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/stores/memory-store.js';

/** テストを決定的にするための操作可能な時計 */
export function createClock(startMs = Date.UTC(2026, 0, 1, 0, 0, 0)) {
  let current = startMs;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    },
    set(ms) {
      current = ms;
      return current;
    },
  };
}

/**
 * LOCAL_DEV=1 相当のアプリを実ポートで起動する。
 * @param {Record<string,string>} env 追加の環境変数
 */
export async function startServer(env = {}) {
  const clock = createClock();
  const config = loadConfig({ LOCAL_DEV: '1', ...env });
  const store = createMemoryStore({ now: clock.now });
  const app = createApp({ store, config, now: clock.now, logger: { error() {} } });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const api = {
    base,
    clock,
    config,
    store,

    /** 生のfetch。path は '/api/...' */
    request(path, options = {}) {
      return fetch(`${base}${path}`, options);
    },

    async postJson(path, body, options = {}) {
      return fetch(`${base}${path}`, {
        ...options,
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
        body: JSON.stringify(body),
      });
    },

    /** セッションを1件発行してトークンを返す */
    async newToken(headers) {
      const res = await fetch(`${base}/api/session`, { method: 'POST', headers });
      if (res.status !== 201) throw new Error(`session failed: ${res.status}`);
      const json = await res.json();
      return json.token;
    },

    /** セッション発行 → 時計を score 秒進める → スコア送信 */
    async playAndSubmit(name, score, { extraMs = 0 } = {}) {
      const token = await api.newToken();
      clock.advance(score * 1000 + extraMs);
      const res = await api.postJson('/api/scores', { token, name, score });
      return { res, token };
    },

    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };

  return api;
}
