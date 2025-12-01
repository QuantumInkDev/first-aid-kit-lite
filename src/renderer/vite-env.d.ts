/// <reference types="vite/client" />

// Global constants defined in electron.vite.config.ts
declare const __APP_VERSION__: string;
declare const __APP_NAME__: string;

interface ImportMetaEnv {
  readonly NODE_ENV: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}