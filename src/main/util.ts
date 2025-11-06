/// <reference types="node" />
/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

/**
 * Returns whether debug UI (devtools, debug menu entries) should be enabled.
 *
 * Simple rule:
 * - Enabled in development (NODE_ENV === 'development')
 * - Otherwise, enabled only when DEBUG_PROD === 'true'
 */
export function shouldEnableDebugUI(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === 'development') return true;
  return env.DEBUG_PROD === 'true';
}
