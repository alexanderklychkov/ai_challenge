/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YANDEX_GPT_FOLDER_ID: string;
  readonly VITE_API_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
