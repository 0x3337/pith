import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

global.dirname = function (metaUrl) {
  return path.dirname(fileURLToPath(metaUrl));
};

const findRootPath = (startPath) => {
  let currentPath = startPath;

  while (true) {
    if (fs.existsSync(path.join(currentPath, 'package.json'))) {
      return currentPath;
    }

    let parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      return startPath;
    }

    currentPath = parentPath;
  }
};

global.__rootpath = findRootPath(process.cwd());
global.__apppath = path.join(__rootpath, 'app');

const require = createRequire(path.join(__rootpath, 'package.json'));

dotenv.config({
  path: path.join(__rootpath, '.env'),
  quiet: true,
});

global.config = (key = null, defaultValue = null) => {
  let keySegments = (key ?? 'app').split('.');
  let fileName = keySegments.shift();
  key = keySegments.join('.');

  let configPath;

  try {
    configPath = require.resolve(path.join(__apppath, 'config', fileName));
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }

    return defaultValue;
  }

  let config = require(configPath);

  if (!key) {
    return config;
  }

  if (key in config) {
    return config[key];
  }

  for (const segment of key.split('.')) {
    if (segment in config) {
      config = config[segment];
    } else {
      return defaultValue;
    }
  }

  return config;
};

global.environment = (...environments) => {
  return environments.includes(config('app.env'));
};

global.serverUrl = (server, path = '') => {
  let baseUrl = config(`app.servers.${server}.host`);
  return (new URL(path, baseUrl)).toString();
};

global.url = (path = '') => {
  return serverUrl(config('app.defaultServer', 'main'), path);
};
