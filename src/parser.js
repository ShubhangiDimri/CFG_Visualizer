/**
 * parser.js (CFG Visualizer Edition)
 * This file implements the full compiler pipeline:
 * Source -> TAC -> Leader ID -> Basic Blocks -> CFG -> Complexity
 */

/**
 * Step 1: Lexical Pre-processing
 */
export const parseCode = (code) => {
  return code
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
};

/**
 * Step 2: Intermediate Code Generation (Three Address Code)
 * This is a simplified TAC generator for academic purposes.
 */
export const generateTAC = (lines) => {
  let tac = [];
  let jumpStack = [];
  let currentLine = 1;

  lines.forEach((line) => {
    if (line.startsWith('if')) {
      const condition = line.match(/\((.*)\)/)?.[1] || 'cond';
      tac.push({ line: currentLine++, text: `if ${condition} goto _TRUE_`, isJump: true });
      tac.push({ line: currentLine++, text: `goto _FALSE_`, isJump: true });
      jumpStack.push({ type: 'if', trueIdx: tac.length - 2, falseIdx: tac.length - 1 });
    } 
    else if (line.startsWith('while')) {
      const condition = line.match(/\((.*)\)/)?.[1] || 'cond';
      const startLine = currentLine;
      tac.push({ line: currentLine++, text: `if ${condition} goto _BODY_`, isJump: true });
      tac.push({ line: currentLine++, text: `goto _END_`, isJump: true });
      jumpStack.push({ type: 'while', bodyIdx: tac.length - 2, endIdx: tac.length - 1, startLine });
    } 
    else if (line.startsWith('else')) {
      const context = jumpStack[jumpStack.length - 1];
      if (context && context.type === 'if') {
        context.hasElse = true;
        context.trueEndIdx = tac.length;
        tac.push({ line: currentLine++, text: `goto _EXIT_`, isJump: true });
      }
    } 
    else if (line.includes('}')) {
      const context = jumpStack.pop();
      if (!context) return;

      if (context.type === 'if') {
        if (context.hasElse) {
          // Resolve exit jump for true block
          tac[context.trueEndIdx].target = currentLine;
          tac[context.trueEndIdx].text = `goto ${currentLine}`;
          // Resolve true branch target
          tac[context.trueIdx].target = context.trueIdx + 3; // +2 for instructions, 1-based
          tac[context.trueIdx].text = tac[context.trueIdx].text.replace('_TRUE_', tac[context.trueIdx].target);
          // Resolve false branch target (start of else)
          tac[context.falseIdx].target = context.trueEndIdx + 2;
          tac[context.falseIdx].text = tac[context.falseIdx].text.replace('_FALSE_', tac[context.falseIdx].target);
        } else {
          // Resolve true branch
          tac[context.trueIdx].target = currentLine - 1;
          tac[context.trueIdx].text = tac[context.trueIdx].text.replace('_TRUE_', context.trueIdx + 3);
          // Resolve false branch (skip to end)
          tac[context.falseIdx].target = currentLine;
          tac[context.falseIdx].text = tac[context.falseIdx].text.replace('_FALSE_', currentLine);
        }
      } 
      else if (context.type === 'while') {
        tac.push({ line: currentLine++, text: `goto ${context.startLine}`, isJump: true, target: context.startLine });
        // Resolve entry jump
        tac[context.bodyIdx].target = context.bodyIdx + 3;
        tac[context.bodyIdx].text = tac[context.bodyIdx].text.replace('_BODY_', tac[context.bodyIdx].target);
        // Resolve exit jump
        tac[context.endIdx].target = currentLine;
        tac[context.endIdx].text = tac[context.endIdx].text.replace('_END_', currentLine);
      }
    } 
    else if (!line.includes('{')) {
      tac.push({ line: currentLine++, text: line, isJump: false });
    }
  });

  return tac;
};

/**
 * Step 3: Leader Identification
 * Rules:
 * 1. First instruction is a leader.
 * 2. Target of any jump is a leader.
 * 3. Instruction following a jump is a leader.
 */
export const identifyLeaders = (tac) => {
  let leaders = new Set([1]); // Rule 1

  tac.forEach((instr, idx) => {
    if (instr.isJump) {
      if (instr.target) leaders.add(instr.target); // Rule 2
      if (idx + 2 <= tac.length) leaders.add(idx + 2); // Rule 3 (1-based index)
    }
  });

  return Array.from(leaders).sort((a, b) => a - b);
};

/**
 * Step 4: Basic Block Formation
 * Group instructions between leaders.
 */
export const formBasicBlocks = (tac, leaders) => {
  let blocks = [];
  
  for (let i = 0; i < leaders.length; i++) {
    const startLine = leaders[i];
    const endLine = (i + 1 < leaders.length) ? leaders[i + 1] - 1 : tac.length;
    
    const instructions = tac.filter(instr => instr.line >= startLine && instr.line <= endLine);
    
    blocks.push({
      id: `B${i + 1}`,
      range: `${startLine}${startLine !== endLine ? '–' + endLine : ''}`,
      instructions: instructions
    });
  }
  
  return blocks;
};

/**
 * Step 5: CFG Construction from Basic Blocks
 */
export const buildCFGFromBlocks = (blocks, tac) => {
  const nodes = [];
  const edges = [];
  const VERTICAL_SPACING = 150;
  
  blocks.forEach((block, idx) => {
    const label = block.instructions.map(i => `${i.line}: ${i.text}`).join('\n');
    const isCondition = block.instructions.some(i => i.text.startsWith('if'));
    
    nodes.push({
      id: block.id,
      type: isCondition ? 'condition' : 'statement',
      data: { label },
      position: { x: 400, y: 50 + idx * VERTICAL_SPACING }
    });

    // Determine edges by checking the last instruction of the block
    const lastInstr = block.instructions[block.instructions.length - 1];
    if (lastInstr.isJump) {
      if (lastInstr.text.startsWith('if')) {
        // True branch to target
        const trueTargetBlock = blocks.find(b => b.instructions[0]?.line === lastInstr.target);
        if (trueTargetBlock) {
          edges.push({
            id: `edge-${block.id}-${trueTargetBlock.id}-true`,
            source: block.id,
            target: trueTargetBlock.id,
            label: 'True',
            animated: true
          });
        }
        // False branch to next instruction
        const falseTargetBlock = blocks[idx + 1];
        if (falseTargetBlock) {
          edges.push({
            id: `edge-${block.id}-${falseTargetBlock.id}-false`,
            source: block.id,
            target: falseTargetBlock.id,
            label: 'False',
            animated: true
          });
        }
      } else {
        // Unconditional jump
        const targetBlock = blocks.find(b => b.instructions[0]?.line === lastInstr.target);
        if (targetBlock) {
          edges.push({
            id: `edge-${block.id}-${targetBlock.id}`,
            source: block.id,
            target: targetBlock.id,
            animated: true,
            label: lastInstr.text.includes('goto') && lastInstr.target < lastInstr.line ? 'Loop Back' : ''
          });
        }
      }
    } else {
      // Sequential flow to next block
      const nextBlock = blocks[idx + 1];
      if (nextBlock) {
        edges.push({
          id: `edge-${block.id}-${nextBlock.id}`,
          source: block.id,
          target: nextBlock.id,
          animated: true
        });
      }
    }
  });

  return { nodes, edges };
};

/**
 * Cyclomatic Complexity
 */
export const calculateCyclomaticComplexity = (nodes, edges) => {
  if (nodes.length === 0) return 0;
  return edges.length - nodes.length + 2;
};
