export default defineEventHandler((event) => {
  console.log(event.context.vars.data);
  return Object.keys(event.context.vars.data);
});
