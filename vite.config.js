import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const peopleDirectory = new URL('./public/people/', import.meta.url);
const dataVersion = createHash('sha256');
for (const name of readdirSync(peopleDirectory).sort()) {
  dataVersion.update(readFileSync(new URL(name, peopleDirectory)));
}

export default defineConfig({
  base: '/family-tree/',
  define: { __PEOPLE_VERSION__: JSON.stringify(dataVersion.digest('hex').slice(0, 12)) },
});
