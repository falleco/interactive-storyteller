import type { ConfigPlugin } from 'expo/config-plugins';
import withGodotFiles from './withGodotFiles';
import withPckFile from './withPckFile';

const withPlugin: ConfigPlugin = (config) => {
  // Copy available Godot games to Android assets.
  config = withGodotFiles(config);
  // Copy available Godot packs to the iOS bundle.
  return withPckFile(config);
};

export default withPlugin;
