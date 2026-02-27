export const builtinModules: string[] = [];

export function createRequire(): (id: string) => never {
  return (id: string) => {
    throw new Error(`createRequire is unavailable in browser runtime (requested: ${id}).`);
  };
}
