import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png', 'manifest.json'],
        manifest: {
          name: 'BetBoy AI: Football Predictions',
          short_name: 'BetBoy AI',
          start_url: '/',
          display: 'standalone',
          background_color: '#0a0f1d',
          theme_color: '#0a0f1d',
          orientation: 'portrait',
          icons: [
            {
              src: 'https://www.betboyai.co.uk/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'https://www.betboyai.co.uk/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          navigateFallback: null,
          ignoreURLParametersMatching: [/.*/],
          globPatterns: ['**/*.{js,css,ico,png,svg,json}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'betboy-html-nav-v28',
                networkTimeoutSeconds: 4,
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      {
        name: 'espn-and-odds-cors-proxy',
        configureServer(server) {
          server.middlewares.use('/api/espn-proxy', async (req, res) => {
            try {
              const reqUrl = new URL(req.url || '', 'http://localhost:3000');
              const target = reqUrl.searchParams.get('url') || '';
              if (
                !target.startsWith('https://site.api.espn.com/') &&
                !target.startsWith('https://api.the-odds-api.com/') &&
                !target.startsWith('https://www.thesportsdb.com/') &&
                !target.startsWith('https://v3.football.api-sports.io/')
              ) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid target URL' }));
                return;
              }
              const fwdHeaders: Record<string, string> = {};
              if (req.headers['x-apisports-key']) {
                fwdHeaders['x-apisports-key'] = String(req.headers['x-apisports-key']);
              }
              const upstream = await fetch(target, Object.keys(fwdHeaders).length ? { headers: fwdHeaders } : undefined);
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(text);
            } catch (err: any) {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: err?.message || 'Proxy error' }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
