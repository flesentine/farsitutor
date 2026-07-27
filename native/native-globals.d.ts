export {};

declare global {
  interface Window {
    __FARSI_NATIVE_APP_SCRIPTS__?: string[];
    FarsiPlatform?: {
      registerAdapter(adapter: Record<string, (...args: any[]) => Promise<unknown>>): void;
    };
    FarsiStorage?: {
      registerAdapter(adapter: Record<string, unknown>): Promise<Record<string, unknown>>;
    };
    FarsiNative?: Readonly<{
      ready: boolean;
      platform: string;
      storageHydration: Record<string, unknown>;
      error: unknown;
    }>;
  }
}
