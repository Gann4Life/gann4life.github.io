import { fileURLToPath } from 'node:url';
import { MAX_REQUEST_BYTES } from './assets.mjs';
import { handleRequest } from './file.mjs';

const readLimited = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        failed = true;
        reject(Object.assign(new Error('Body too large'), { code: 'TOO_LARGE' }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

export default function editor() {
  return {
    name: 'editor',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig, injectScript }) => {
        if (command !== 'dev') return;
        injectScript('page', "import '/integrations/editor/client.ts';");
        const root = fileURLToPath(config.root);
        const trimmed = String(config.base ?? '/').replace(/^\/+|\/+$/g, '');
        const base = trimmed ? `/${trimmed}/` : '/';
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'editor-endpoint',
                apply: 'serve',
                configureServer(server) {
                  const loadRegistry = async () => {
                    const { z } = await server.ssrLoadModule('astro/zod');
                    const { COLLECTIONS } = await server.ssrLoadModule('/src/lib/content-fields.ts');
                    const { schemaFor } = await server.ssrLoadModule('/src/lib/content-schema.ts');
                    const { toolSlug } = await server.ssrLoadModule('/src/lib/slug.ts');
                    return { collections: COLLECTIONS, schemaFor: (name) => schemaFor(name, () => z.string()), toolSlug };
                  };
                  server.middlewares.use(async (req, res, next) => {
                    let result;
                    try {
                      result = await handleRequest(
                        {
                          method: req.method,
                          url: req.originalUrl ?? req.url,
                          remoteAddress: req.socket.remoteAddress,
                          headers: req.headers,
                          readBody: () => readLimited(req),
                        },
                        { root, base, loadRegistry },
                      );
                    } catch (err) {
                      console.error('[editor]', err);
                      result = { status: 500, body: { error: 'Unexpected error.' }, headers: {} };
                    }
                    if (!result) return next();
                    res.statusCode = result.status;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
                    res.end(JSON.stringify(result.body));
                  });
                  const { stack } = server.middlewares;
                  stack.unshift(stack.pop());
                },
              },
            ],
          },
        });
      },
    },
  };
}