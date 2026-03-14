/**
 * halBlockMeta.js
 *
 * Bridges board-specific block definitions (from boardLibraryBlocks.js)
 * to the transpiler's lookup tables (FB_TRIGGER_PIN, FB_INPUTS, etc.).
 *
 * Called by CTranspilerService when a boardId is provided.
 */
import { getBoardLibraryTree } from './boardLibraryBlocks';

/**
 * Build transpiler-compatible lookup table entries for every board block
 * available on the given board.
 *
 * @param {string} boardId  e.g. 'rpi_5', 'bb_black'
 * @returns {{ triggerPin, inputs, outputs, qOutput, inputTypes }}
 */
export const getBoardBlockMeta = (boardId) => {
  if (!boardId) return { triggerPin: {}, inputs: {}, outputs: {}, qOutput: {}, inputTypes: {} };

  const tree = getBoardLibraryTree(boardId);

  const triggerPin = {};
  const inputs = {};
  const outputs = {};
  const qOutput = {};
  const inputTypes = {};

  tree.forEach(sub => {
    sub.items.forEach(item => {
      const bt = item.blockType;
      const cd = item.customData;

      const inPins = (cd.inputs || []).map(i => i.name);
      const outPins = (cd.outputs || []).map(o => o.name);

      // All board blocks use EN as trigger pin for power-flow
      triggerPin[bt] = 'EN';

      // ENO is the power-flow output
      qOutput[bt] = 'ENO';

      // Input pin names (excluding EN -- the transpiler handles it separately)
      inputs[bt] = inPins.filter(n => n !== 'EN');

      // Output pin names (excluding ENO)
      outputs[bt] = ['ENO', ...outPins.filter(n => n !== 'ENO')];

      // Input types map
      inputTypes[bt] = {};
      (cd.inputs || []).forEach(i => {
        inputTypes[bt][i.name] = i.type;
      });
    });
  });

  return { triggerPin, inputs, outputs, qOutput, inputTypes };
};
