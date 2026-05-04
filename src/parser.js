/**
 * parser.js (Final UI Improvements)
 * This file handles the transformation of code into a Control Flow Graph (CFG).
 * Supports: Sequential statements, if/else branching, and while loops.
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
 * Step 2: Advanced CFG Construction with UI Types
 */
export const buildCFG = (lines) => {
  const nodes = [];
  const edges = [];
  let prevNodes = []; 
  let branchStack = [];
  
  // Layout Constants
  const VERTICAL_SPACING = 120;
  const HORIZONTAL_SPACING = 200;
  const CENTER_X = 400;
  
  let currentY = 50;

  lines.forEach((line, index) => {
    const nodeId = `node-${index}`;
    
    // Logic Detection
    const isIf = line.startsWith('if');
    const isWhile = line.startsWith('while');
    const isElse = line.startsWith('else');
    const isBraceClose = line.includes('}');
    const isBraceOpen = line.includes('{');

    const isCondition = isIf || isWhile;
    const isExecutable = !isElse && !isBraceOpen && !isBraceClose && !isCondition;

    // Handle Decision Nodes (If/While)
    if (isCondition) {
      const node = {
        id: nodeId,
        type: 'condition', // Custom node type
        data: { label: line },
        position: { x: CENTER_X, y: currentY },
      };
      nodes.push(node);
      currentY += VERTICAL_SPACING;

      // Connect previous flow
      prevNodes.forEach(prev => {
        edges.push({
          id: `edge-${prev.id}-${nodeId}`,
          source: prev.id,
          target: nodeId,
          label: prev.label || '',
          animated: true,
          labelStyle: { fill: '#94a3b8', fontWeight: 700, fontSize: 10 },
          labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
        });
      });

      branchStack.push({
        type: isIf ? 'if' : 'while',
        conditionId: nodeId,
        trueExits: [],
        isAtElse: false,
        startY: currentY - VERTICAL_SPACING
      });

      prevNodes = [{ id: nodeId, label: 'True' }];
    } 
    
    // Handle Normal Executable Statements
    else if (isExecutable) {
      // Determine X position based on branch context
      let xPos = CENTER_X;
      if (branchStack.length > 0) {
        const current = branchStack[branchStack.length - 1];
        if (current.isAtElse) {
          xPos = CENTER_X + HORIZONTAL_SPACING;
        } else if (current.type === 'if' || current.type === 'while') {
          // If we are in the 'true' branch of an IF or inside a WHILE
          xPos = CENTER_X - HORIZONTAL_SPACING;
        }
      }

      const node = {
        id: nodeId,
        type: 'statement', // Custom node type
        data: { label: line },
        position: { x: xPos, y: currentY }
      };
      nodes.push(node);
      currentY += VERTICAL_SPACING - 20;

      // Connect previous flow
      prevNodes.forEach(prev => {
        edges.push({
          id: `edge-${prev.id}-${nodeId}`,
          source: prev.id,
          target: nodeId,
          label: prev.label || '',
          animated: true,
          labelStyle: { fill: '#94a3b8', fontWeight: 700, fontSize: 10 },
          labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
        });
      });

      prevNodes = [{ id: nodeId }];
    }

    // Handle Else Keyword
    if (isElse) {
      const currentBranch = branchStack[branchStack.length - 1];
      if (currentBranch && currentBranch.type === 'if') {
        currentBranch.trueExits = [...prevNodes];
        currentBranch.isAtElse = true;
        prevNodes = [{ id: currentBranch.conditionId, label: 'False' }];
        // Reset Y slightly for the else branch to keep it somewhat aligned
        // currentY = currentBranch.startY + VERTICAL_SPACING; 
      }
    }

    // Handle Closing Braces
    if (isBraceClose) {
      const context = branchStack.pop();
      if (context) {
        if (context.type === 'while') {
          // WHILE LOOP: Create back edge
          prevNodes.forEach(prev => {
            edges.push({
              id: `edge-${prev.id}-${context.conditionId}-back`,
              source: prev.id,
              target: context.conditionId,
              label: 'Loop Back',
              animated: true,
              style: { stroke: '#fbbf24', strokeWidth: 2 },
              labelStyle: { fill: '#fbbf24', fontWeight: 700 },
            });
          });
          prevNodes = [{ id: context.conditionId, label: 'False' }];
        } 
        else if (context.type === 'if') {
          if (context.isAtElse) {
            prevNodes = [...context.trueExits, ...prevNodes];
          } else {
            prevNodes = [...prevNodes, { id: context.conditionId, label: 'False' }];
          }
        }
      }
    }
  });

  return { nodes, edges };
};

/**
 * Step 3: Cyclomatic Complexity
 */
export const calculateCyclomaticComplexity = (nodes, edges) => {
  if (nodes.length === 0) return 0;
  return edges.length - nodes.length + 2;
};
