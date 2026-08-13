/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_HOMEPAGE_URL: string
  readonly VITE_SAMPLE_RESULT_FORM_URL: string
  readonly VITE_USE_SUPABASE_QUESTIONS: string
  readonly VITE_USE_SUPABASE_SUBMIT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.lottie?url' {
  const src: string
  export default src
}
