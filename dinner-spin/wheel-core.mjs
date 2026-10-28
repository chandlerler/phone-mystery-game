export const OPTIONS = Object.freeze(['早吃早走','早吃晚走','早吃不走','晚吃早走','晚吃晚走','晚吃不走','不吃早走','不吃晚走','不吃不走']);
export const COLORS = Object.freeze(['#dde8b7','#f4dda4','#f1cbb5','#e8cfd9','#d7d2e8','#cddce8','#bcdace','#d1e2bd','#e8e7bb']);
export const SECTOR_DEGREES = 360 / OPTIONS.length;
// Discard the incomplete final bucket so every result has exactly the same number of inputs.
export function randomIndex(cryptoSource = globalThis.crypto) {
  const range = 2 ** 32;
  const limit = range - (range % OPTIONS.length);
  const sample = new Uint32Array(1);
  do { cryptoSource.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % OPTIONS.length;
}
export function rotationFor(index, currentRotation = 0) {
  const current = ((currentRotation % 360) + 360) % 360;
  const destination = (360 - index * SECTOR_DEGREES) % 360;
  return currentRotation + 360 * 6 + ((destination - current + 360) % 360);
}
