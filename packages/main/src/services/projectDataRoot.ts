import path from 'node:path';

const PROJECT_DATA_DIR_NAME = 'DATA';

export function getProjectDataRoot(): string {
  const configuredRoot = process.env.QIUAI_DATA_DIR?.trim();
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(process.cwd(), PROJECT_DATA_DIR_NAME);
}

export function resolveProjectDataPath(...segments: string[]): string {
  return path.join(getProjectDataRoot(), ...segments);
}
