export default {
  signature: 'main:greet',
  description: 'Print a greeting',
  run: () => {
    console.log(`Hello from ${config('app.name')}`);
  },
};
