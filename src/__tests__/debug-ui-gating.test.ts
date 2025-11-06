/// <reference types="node" />
import { shouldEnableDebugUI } from '../main/util';

describe('shouldEnableDebugUI', () => {
  const baseEnv: NodeJS.ProcessEnv = {} as any;

  it('enables in development regardless of packaging', () => {
    const env = { ...baseEnv, NODE_ENV: 'development' } as NodeJS.ProcessEnv;
    expect(shouldEnableDebugUI(env)).toBe(true);
  });

  it('enables in production when DEBUG_PROD=true and not in CI', () => {
    const env = {
      ...baseEnv,
      NODE_ENV: 'production',
      DEBUG_PROD: 'true',
    } as NodeJS.ProcessEnv;
    expect(shouldEnableDebugUI(env)).toBe(true);
  });

  it('disables in production when DEBUG_PROD is not set', () => {
    const env = {
      ...baseEnv,
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv;
    expect(shouldEnableDebugUI(env)).toBe(false);
  });

  // No CI distinction in simplified logic
});
