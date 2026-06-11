/// <reference types="node" />

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type ConfigPlugin, withXcodeProject } from 'expo/config-plugins';
import { availableGames } from './available-games';

/**
 * Expo config plugin to copy available Godot iOS packs into the iOS bundle.
 * @param config - Expo config
 */
const withPckFiles: ConfigPlugin = (config) => {
  return withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const project = config.modResults;
    const targetUuid = project.getFirstTarget().uuid;
    const mainGroupKey = project.getFirstProject().firstProject.mainGroup;

    if (!mainGroupKey) {
      console.error('Could not find main group');
      return config;
    }

    for (const gameName of availableGames) {
      const sourcePath = path.join(
        projectRoot,
        'assets',
        'godot',
        gameName,
        'ios.pck',
      );
      const packName = `${gameName}.pck`;
      const destPath = path.join(projectRoot, 'ios', packName);

      if (!fs.existsSync(sourcePath)) {
        throw new Error(
          `Godot iOS pack for "${gameName}" not found at ${sourcePath}`,
        );
      }

      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${sourcePath} to ${destPath}`);

      if (!project.hasFile(packName)) {
        const packFile = project.addFile(
          packName,
          mainGroupKey,
          {
            defaultEncoding: 4,
            lastKnownFileType: 'file',
          },
        );

        if (packFile) {
          packFile.uuid = project.generateUuid();
          packFile.target = targetUuid;
          project.addToPbxBuildFileSection(packFile);
          project.addToPbxResourcesBuildPhase(packFile);
        }
      }
    }

    return config;
  });
};

export default withPckFiles;
