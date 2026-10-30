import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest, MAX_BODY_BYTES } from './file.mjs';

const readLimited = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        reject(Object.assign(new Error('Body too large'), { code: 'TOO_LARGE' }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

export default function workEditor() {
  let active = false;
  let root = '';
  let base = '/';
  return {
    name: 'work-editor',
    hooks: {
      'astro:config:setup': ({ command, config }) => {
        if (command !== 'dev') return;
        active = true;
        root = fileURLToPath(config.root);
        const trimmed = String(config.base ?? '/').replace(/^\/+|\/+$/g, '');
        base = trimmed ? `/${trimmed}/` : '/';
      },
      'astro:server:setup': ({ server }) => {
        if (!active) return;
        const workDir = path.join(root, 'src', 'content', 'work');
        const loadSchema = async () => {
          const { z } = await server.ssrLoadModule('astro/zod');
          const { workSchema } = await server.ssrLoadModule('/src/lib/work-schema.ts');
          return workSchema(() => z.string());
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
              { workDir, base, loadSchema },
            );
          } catch (err) {
            console.error('[work-editor]', err);
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
      },
    },
  };
}
