const callbacks = [];

export const onShutdown = (callback) => {
  callbacks.push(callback);
};

export const shutdown = async () => {
  while (callbacks.length) {
    await callbacks.pop()();
  }
};
