export function resolve(specifier, context, nextResolve) {
  if (specifier === 'nodemailer') {
    return { url: new URL('./tmp-stub.mjs', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
