import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: './', // build estática: funciona en cualquier carpeta u hosting
  // .claude/ guarda copias de trabajo del proyecto (worktrees): sus pruebas no son las de este repositorio
  test: { exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'] },
});
