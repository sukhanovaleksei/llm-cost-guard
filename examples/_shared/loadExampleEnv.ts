import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

export const loadExampleEnv = (metaUrl: string): void => {
  loadDotenv();

  const filePath = fileURLToPath(metaUrl);
  const directoryPath = dirname(filePath);

  loadDotenv({ path: resolve(directoryPath, '.env'), override: false });
};
