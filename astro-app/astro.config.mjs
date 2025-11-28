// @ts-check
import { defineConfig } from 'astro/config';
import dotenv from 'dotenv';

import react from '@astrojs/react';
import node from '@astrojs/node';

import tailwindcss from '@tailwindcss/vite';

// Load env from repo root (../.env) first, then local astro-app/.env
dotenv.config({ path: '../.env' });
dotenv.config();

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});
