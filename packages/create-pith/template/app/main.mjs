export default (main) => {
  main.get('/', async (req, res) => {
    res.render('template', {
      page: 'home',
      title: 'Pith',
      description: 'A new pith project.',
    });
  });

  return main;
};
