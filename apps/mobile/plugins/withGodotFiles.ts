/// <reference types="node" />

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import { availableGames } from './available-games';

/**
 * Recursively copy a directory
 */
function copyDirectory(src: string, dest: string): void {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read all files and directories from source
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectories
      copyDirectory(srcPath, destPath);
    } else {
      // Copy files
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Expo config plugin to copy available Godot Android exports to Android assets.
 * @param config - Expo config
 */
const withGodotFiles: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const assetsDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets',
      );
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const legacyDestPath = path.join(assetsDir, 'main');
      if (fs.existsSync(legacyDestPath)) {
        fs.rmSync(legacyDestPath, { recursive: true, force: true });
      }

      for (const gameName of availableGames) {
        const sourcePath = path.join(
          projectRoot,
          'assets',
          'godot',
          gameName,
          'android',
        );
        const destPath = path.join(assetsDir, gameName);

        if (!fs.existsSync(sourcePath)) {
          throw new Error(
            `Godot Android export for "${gameName}" not found at ${sourcePath}`,
          );
        }

        fs.rmSync(destPath, { recursive: true, force: true });
        copyDirectory(sourcePath, destPath);
        console.log(`Copied Godot files from ${sourcePath} to ${destPath}`);
      }

      return config;
    },
  ]);
};

export default withGodotFiles;
