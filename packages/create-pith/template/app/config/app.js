module.exports = {
  name: 'Pith',
  env: process.env.APP_ENV,
  servers: {
    main: {
      host: process.env.SERVER_URL,
      port: process.env.SERVER_PORT,
    },
  },
};
