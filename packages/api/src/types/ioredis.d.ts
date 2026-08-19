// Ambient stub for ioredis. The real package is declared in package.json and
// loaded via dynamic import() only when REDIS_URL is configured, so the API
// compiles and runs (on the in-memory fallback) without ioredis installed.
// `pnpm install` before enabling Redis in production pulls the real client.
declare module 'ioredis' {
  const Redis: any;
  export default Redis;
}
