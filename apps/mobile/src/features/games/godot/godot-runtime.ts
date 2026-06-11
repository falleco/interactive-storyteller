import { RTNGodot, runOnGodotThread } from '@borndotcom/react-native-godot';
import { isDevice } from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type GodotThreadResult = {
  error?: string;
  hasApi?: boolean;
  hasInput?: boolean;
  hasInstance?: boolean;
  ok: boolean;
  phase: string;
};

export function toLoggableError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    raw: error,
  };
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initGodotGame({
  gameName,
  logPrefix,
}: {
  gameName: string;
  logPrefix: string;
}): Promise<boolean> {
  const iosPackUri = `${FileSystem.bundleDirectory}${gameName}.pck`;
  const androidAssetPath = `/${gameName}`;

  console.log(`${logPrefix} init requested`, {
    androidAssetPath,
    bundleDirectory: FileSystem.bundleDirectory,
    gameName,
    iosPackUri,
    platform: Platform.OS,
  });

  if (Platform.OS !== 'android') {
    try {
      const packInfo = await FileSystem.getInfoAsync(iosPackUri);

      console.log(`${logPrefix} iOS pack file info`, {
        exists: packInfo.exists,
        isDirectory: packInfo.exists ? packInfo.isDirectory : undefined,
        modificationTime: packInfo.exists
          ? packInfo.modificationTime
          : undefined,
        size: packInfo.exists ? packInfo.size : undefined,
        uri: packInfo.uri,
      });

      if (!packInfo.exists) {
        console.error(`${logPrefix} iOS pack is missing`, { iosPackUri });
        return false;
      }
    } catch (error) {
      console.error(`${logPrefix} failed to inspect iOS pack`, {
        error,
        iosPackUri,
      });
      return false;
    }
  }

  const initResult = (await runOnGodotThread(() => {
    'worklet';
    console.log(`${logPrefix} initializing Godot on Godot thread`);

    try {
      const existing = RTNGodot.getInstance();
      if (existing != null) {
        console.log(`${logPrefix} destroying previous Godot instance`);
        RTNGodot.destroyInstance();
      }

      if (Platform.OS === 'android') {
        const launchArgs = [
          '--verbose',
          '--path',
          androidAssetPath,
          '--rendering-driver',
          'opengl3',
          '--rendering-method',
          'gl_compatibility',
          '--display-driver',
          'embedded',
        ];
        console.log(`${logPrefix} Android createInstance args`, launchArgs);
        RTNGodot.createInstance(launchArgs);
      } else {
        const args = [
          '--verbose',
          '--main-pack',
          iosPackUri,
          '--display-driver',
          'embedded',
        ];

        if (isDevice) {
          args.push(
            '--rendering-driver',
            'opengl3',
            '--rendering-method',
            'gl_compatibility',
          );
        } else {
          args.push(
            '--rendering-driver',
            'metal',
            '--rendering-method',
            'mobile',
          );
        }

        console.log(`${logPrefix} iOS createInstance args`, args);
        RTNGodot.createInstance(args);
      }

      const instance = RTNGodot.getInstance();
      const hasInstance = instance != null;
      console.log(`${logPrefix} createInstance returned`, { hasInstance });

      return {
        hasInstance,
        ok: hasInstance,
        phase: 'createInstance',
      };
    } catch (error) {
      const message = String(error);
      console.error(`${logPrefix} createInstance failed`, message);

      return {
        error: message,
        ok: false,
        phase: 'createInstance',
      };
    }
  })) as GodotThreadResult;

  console.log(`${logPrefix} init thread result`, initResult);

  if (!initResult.ok) {
    return false;
  }

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const apiResult = (await runOnGodotThread(() => {
      'worklet';

      try {
        const instance = RTNGodot.getInstance();
        const Godot = RTNGodot.API();
        const Input = Godot.Input;
        const hasInstance = instance != null;
        const hasApi = Godot != null;
        const hasInput = Input != null;

        return {
          hasApi,
          hasInput,
          hasInstance,
          ok: hasInstance && hasApi && hasInput,
          phase: 'apiProbe',
        };
      } catch (error) {
        const message = String(error);
        console.error(`${logPrefix} API probe failed`, message);

        return {
          error: message,
          ok: false,
          phase: 'apiProbe',
        };
      }
    })) as GodotThreadResult;

    console.log(`${logPrefix} API probe result`, { attempt, apiResult });

    if (apiResult.ok) {
      return true;
    }

    await wait(250);
  }

  console.error(`${logPrefix} Godot API not ready after probes`);
  return false;
}

export function destroyGodotGame(logPrefix: string) {
  void runOnGodotThread(() => {
    'worklet';
    try {
      const existing = RTNGodot.getInstance();
      if (existing != null) {
        console.log(`${logPrefix} destroying Godot instance`);
        RTNGodot.destroyInstance();
      }
    } catch (error) {
      console.error(`${logPrefix} destroy failed`, String(error));
    }
  }).catch((error: unknown) => {
    console.error(`${logPrefix} destroy worklet rejected`, {
      error: toLoggableError(error),
    });
  });
}
