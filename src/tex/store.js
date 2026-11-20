/**
 * Dreamback Texture Kit — Internal Store (breaks circular deps between registry.js and T1..T9 modules)
 */

const defs = new Map();
const materialRecipes = new Map();
const sharedFieldCache = new Map();

export function register(id, spec) {
  defs.set(id, { id, ...spec });
}

export function registerMaterial(id, recipe) {
  materialRecipes.set(id, recipe);
}

export function getDef(id) {
  return defs.get(id);
}

export function getAllDefs() {
  return Array.from(defs.values());
}

export function getMaterialRecipe(id) {
  return materialRecipes.get(id);
}

export function getAllMaterialRecipes() {
  return materialRecipes;
}

export function clearSharedFields() {
  sharedFieldCache.clear();
}

export function getOrComputeField(key, fn) {
  if (sharedFieldCache.has(key)) return sharedFieldCache.get(key);
  const val = fn();
  sharedFieldCache.set(key, val);
  return val;
}
