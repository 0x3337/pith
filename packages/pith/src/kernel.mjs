import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { program } from 'commander';
import { pathToFileURL } from 'node:url';

import './globals.mjs';
import { shutdown } from './shutdown.mjs';

const serversPath = () => path.join(__apppath, 'servers');

const importModule = async (modulePath) => {
  const { default: module } = await import(pathToFileURL(modulePath).href);

  return module;
};

const serverConfig = () => {
  const servers = config('app.servers');

  if (!servers || !Object.keys(servers).length) {
    throw new Error('Missing app.servers in app/config/app.js: declare at least one server with a port.');
  }

  return servers;
};

const serverPath = (serverName) => {
  const candidates = [];

  if (serverName === config('app.defaultServer', 'main')) {
    candidates.push(path.join(__apppath, `${serverName}.mjs`));
  }

  candidates.push(
    path.join(serversPath(), serverName, `${serverName}.mjs`),
    path.join(serversPath(), serverName, 'index.mjs'),
    path.join(serversPath(), `${serverName}.mjs`),
  );

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));

  if (!resolved) {
    const expected = candidates.map((candidate) => path.relative(__rootpath, candidate)).join(', ');
    throw new Error(`Missing module for server "${serverName}", expected one of: ${expected}.`);
  }

  return resolved;
};

const staticPath = (serverName) => {
  const assetsPath = path.join(__rootpath, 'public', serverName);

  return fs.existsSync(assetsPath)
    ? assetsPath
    : path.join(__rootpath, 'public');
};

const viewsPath = (serverName) => {
  return [
    path.join(__apppath, 'views'),
    path.join(serversPath(), serverName, 'views'),
  ].filter((viewPath) => fs.existsSync(viewPath));
};

const createServer = async (serverName) => {
  const server = express();

  server.disable('x-powered-by');
  server.set('views', viewsPath(serverName));
  server.set('view engine', config('app.viewEngine', 'ejs'));

  const buildServer = await importModule(serverPath(serverName));
  buildServer(server);

  if (!environment('production')) {
    const assetsPath = staticPath(serverName);

    if (fs.existsSync(assetsPath)) {
      server.use(express.static(assetsPath));
    }
  }

  return server;
};

const listenForShutdown = (servers) => {
  const stop = async () => {
    await Promise.all(servers.map((server) => {
      return new Promise((resolve) => server.close(resolve));
    }));

    await shutdown();
    process.exit(0);
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
};

const parseSignature = (signature) => {
  let name = signature.match(/[^\s]+/)[0];

  return { name };
};

const loadCommandsFrom = async (commandPath) => {
  const commands = [];
  const fileNames = fs
    .readdirSync(commandPath)
    .filter((fileName) => /\.m?js$/.test(fileName));

  for (const fileName of fileNames) {
    const command = await importModule(path.join(commandPath, fileName));

    if (!command?.signature || typeof command.run !== 'function') {
      throw new Error(`Command ${path.join(commandPath, fileName)} must export { signature, run }.`);
    }

    command.parsedSignature = parseSignature(command.signature);
    commands.push(command);
  }

  return commands;
};

const loadCommands = async () => {
  const commandPaths = [path.join(__apppath, 'commands')];

  if (fs.existsSync(serversPath())) {
    for (const entry of fs.readdirSync(serversPath(), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        commandPaths.push(path.join(serversPath(), entry.name, 'commands'));
      }
    }
  }

  const commands = [];

  for (const commandPath of commandPaths.filter((commandPath) => fs.existsSync(commandPath))) {
    commands.push(...await loadCommandsFrom(commandPath));
  }

  return commands;
};

export const httpKernel = async () => {
  const serverDefs = serverConfig();
  const servers = [];

  for (const serverName in serverDefs) {
    const { port } = serverDefs[serverName];
    const server = await createServer(serverName);

    servers.push(server.listen(port, () => {
      console.log(`${serverName} listening on port ${port}`);
    }));
  }

  listenForShutdown(servers);

  return servers;
};

export const consoleKernel = async () => {
  let keepAlive = false;

  program
    .command('serve')
    .description('Start the HTTP servers and the scheduled commands')
    .action(async () => {
      keepAlive = true;

      await httpKernel();
      await scheduleKernel();
    });

  for (const command of await loadCommands()) {
    program
      .command(command.parsedSignature.name)
      .description(command.description ?? '')
      .action(command.run);
  }

  try {
    await program.parseAsync();
  } finally {
    if (!keepAlive) {
      await shutdown();
    }
  }
};

export const scheduleKernel = async () => {
  const schedules = config('schedule', {});
  const scheduled = (await loadCommands())
    .map((command) => [schedules[command.parsedSignature.name] ?? command.schedule, command])
    .filter(([schedule]) => schedule);

  const unknown = Object.keys(schedules)
    .filter((name) => !scheduled.some(([, command]) => command.parsedSignature.name === name));

  if (unknown.length) {
    throw new Error(`Unknown commands in app/config/schedule.js: ${unknown.join(', ')}.`);
  }

  if (!scheduled.length) {
    return [];
  }

  const { default: cron } = await import('node-cron');

  return scheduled.map(([schedule, command]) => {
    console.log(`${command.parsedSignature.name} scheduled at ${schedule}`);

    return cron.schedule(schedule, command.run);
  });
};

export default {
  httpKernel,
  consoleKernel,
  scheduleKernel,
};
