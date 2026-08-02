import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createStore } from './stores/index.js';

const config = loadConfig();
const store = await createStore(config);
const app = createApp({ store, config });

const server = app.listen(config.port, () => {
  console.log(
    `[ranking-api] listening on :${config.port} store=${store.kind} ` +
      `origins=${[...config.allowedOrigins].join(',')}`,
  );
});

// Cloud Run のSIGTERMでグレースフルに閉じる
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[ranking-api] ${signal} received, shutting down`);
    server.close(async () => {
      try {
        await store.close();
      } catch (err) {
        console.error('[ranking-api] store close failed', err);
      }
      process.exit(0);
    });
  });
}
