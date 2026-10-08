import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Sert /models/index.json : liste des .glb déposés dans public/models (+ mapping.json optionnel).
function modelsIndex() {
  const dir = path.resolve('public/models');
  const build = () => {
    let files = [], mapping = {};
    try { files = fs.readdirSync(dir).filter((f) => /\.(glb|gltf)$/i.test(f)); } catch (e) { /* dossier absent */ }
    try { mapping = JSON.parse(fs.readFileSync(path.join(dir, 'mapping.json'), 'utf8')); } catch (e) { /* optionnel */ }
    return JSON.stringify({ files, mapping });
  };
  return {
    name: 'models-index',
    configureServer(server) {
      server.middlewares.use('/models/index.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(build());
      });
    },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'models/index.json', source: build() }); }
  };
}

export default defineConfig({
  plugins: [modelsIndex()],
  server: { host: true, port: 5173 },
  build: { target: 'es2022' }
});
