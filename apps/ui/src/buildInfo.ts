export const BUILD_INFO = {
  hash: (import.meta as any).env.VITE_BUILD_SHA || '',
  time: (import.meta as any).env.VITE_BUILD_TIME || '',
};
