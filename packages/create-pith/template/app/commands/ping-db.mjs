import db from '#pith/db';

export default {
  signature: 'main:db:ping',
  description: 'Check the database connection',
  run: async () => {
    const { rows: [{ now }] } = await db.raw('select now()');

    console.log(`Database is up: ${now.toISOString()}`);
  },
};
