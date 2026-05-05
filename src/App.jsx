import React, { useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

import {
  parseCode,
  generateTAC,
  identifyLeaders,
  formBasicBlocks,
  buildCFGFromBlocks,
  calculateCyclomaticComplexity
} from './parser';
import { Handle, Position } from 'reactflow';

// Custom Statement Node (Rectangle)
const StatementNode = ({ data }) => (
  <div className="custom-node statement-node">
    <Handle type="target" position={Position.Top} />
    <div className="node-content" style={{ whiteSpace: 'pre-wrap' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

// Custom Condition Node (Diamond-like)
const ConditionNode = ({ data }) => (
  <div className="custom-node condition-node">
    <Handle type="target" position={Position.Top} />
    <div className="diamond-container">
      <div className="node-content" style={{ whiteSpace: 'pre-wrap' }}>{data.label}</div>
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const nodeTypes = {
  statement: StatementNode,
  condition: ConditionNode,
};

const initialNodes = [];
const initialEdges = [];

const totalStages = 6;

const FastZoomLayer = ({ containerRef }) => {
  const { zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return undefined;
    }

    const handleWheel = (event) => {
      event.preventDefault();

      const zoomSteps = Math.max(1, Math.ceil(Math.min(Math.abs(event.deltaY) / 40, 4)));

      if (event.deltaY < 0) {
        for (let step = 0; step < zoomSteps; step += 1) {
          zoomIn({ duration: 0 });
        }
      } else {
        for (let step = 0; step < zoomSteps; step += 1) {
          zoomOut({ duration: 0 });
        }
      }
    };

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, zoomIn, zoomOut]);

  return null;
};

const examples = {
  sequential: 'x = 10;\ny = 20;\nz = x + y;\nconsole.log(z);',
  ifElse: 'a = 15;\nif(a > 10){\n  status = "Pass";\n}\nelse{\n  status = "Fail";\n}\nprint(status);',
  whileLoop: 'count = 0;\nwhile(count < 5){\n  count = count + 1;\n  print(count);\n}\ndone = true;',
  complex: 'i = 0;\nsum = 0;\nif(mode == "sum"){\n  while(i < 10){\n    sum = sum + i;\n    i = i + 1;\n  }\n}\nelse{\n  sum = -1;\n}\nreturn sum;'
};

const colorizeIndependentEdges = (graphNodes, graphEdges) => {
  if (!graphNodes?.length || !graphEdges?.length) {
    return graphEdges;
  }

  // For cyclomatic complexity intuition: each decision introduces alternative paths.
  // So we color branch alternatives (True vs False) differently.
  // Additionally, we propagate that color along the corresponding path region
  // until the first merge (a node reachable from both branches).
  const TRUE_COLOR = 'var(--path-true-color)';
  const FALSE_COLOR = 'var(--path-false-color)';

  const outgoingBySource = new Map();
  graphEdges.forEach((edge) => {
    if (!outgoingBySource.has(edge.source)) {
      outgoingBySource.set(edge.source, []);
    }
    outgoingBySource.get(edge.source).push(edge);
  });

  const reachableFrom = (startNodeId) => {
    const visited = new Set();
    const stack = [startNodeId];
    visited.add(startNodeId);

    while (stack.length) {
      const nodeId = stack.pop();
      const outgoing = outgoingBySource.get(nodeId) || [];
      outgoing.forEach((edge) => {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          stack.push(edge.target);
        }
      });
    }

    return visited;
  };

  const distancesFrom = (startNodeId) => {
    const distances = new Map();
    const queue = [startNodeId];
    distances.set(startNodeId, 0);

    while (queue.length) {
      const nodeId = queue.shift();
      const currentDistance = distances.get(nodeId);
      const outgoing = outgoingBySource.get(nodeId) || [];

      outgoing.forEach((edge) => {
        if (!distances.has(edge.target)) {
          distances.set(edge.target, currentDistance + 1);
          queue.push(edge.target);
        }
      });
    }

    return distances;
  };

  const decisionNodeIds = new Set(
    graphEdges
      .filter((edge) => edge.label === 'True' || edge.label === 'False')
      .map((edge) => edge.source)
  );

  const colorByEdgeId = new Map();

  decisionNodeIds.forEach((decisionNodeId) => {
    const outgoing = outgoingBySource.get(decisionNodeId) || [];
    const trueEdge = outgoing.find((edge) => edge.label === 'True');
    const falseEdge = outgoing.find((edge) => edge.label === 'False');

    if (!trueEdge || !falseEdge) {
      return;
    }

    // Always color the branch edges themselves.
    if (!colorByEdgeId.has(trueEdge.id)) {
      colorByEdgeId.set(trueEdge.id, TRUE_COLOR);
    }
    if (!colorByEdgeId.has(falseEdge.id)) {
      colorByEdgeId.set(falseEdge.id, FALSE_COLOR);
    }

    // Determine the earliest merge node between the two branches.
    const reachableTrue = reachableFrom(trueEdge.target);
    const reachableFalse = reachableFrom(falseEdge.target);
    const distTrue = distancesFrom(trueEdge.target);
    const distFalse = distancesFrom(falseEdge.target);

    const common = [];
    reachableTrue.forEach((nodeId) => {
      if (reachableFalse.has(nodeId)) {
        common.push(nodeId);
      }
    });

    if (common.length === 0) {
      return;
    }

    let mergeNodeId = common[0];
    let bestScore = Number.POSITIVE_INFINITY;
    common.forEach((nodeId) => {
      const dt = distTrue.get(nodeId);
      const df = distFalse.get(nodeId);
      if (dt === undefined || df === undefined) {
        return;
      }
      const score = dt + df;
      if (score < bestScore) {
        bestScore = score;
        mergeNodeId = nodeId;
      }
    });

    // Nodes after merge should not be colored.
    const postMergeNodes = reachableFrom(mergeNodeId);
    postMergeNodes.add(mergeNodeId);

    const trueRegionNodes = new Set();
    reachableTrue.forEach((nodeId) => {
      if (!postMergeNodes.has(nodeId)) {
        trueRegionNodes.add(nodeId);
      }
    });

    const falseRegionNodes = new Set();
    reachableFalse.forEach((nodeId) => {
      if (!postMergeNodes.has(nodeId)) {
        falseRegionNodes.add(nodeId);
      }
    });

    // Color all edges whose *source* is inside the branch region.
    graphEdges.forEach((edge) => {
      if (colorByEdgeId.has(edge.id)) {
        return;
      }
      if (trueRegionNodes.has(edge.source)) {
        colorByEdgeId.set(edge.id, TRUE_COLOR);
      } else if (falseRegionNodes.has(edge.source)) {
        colorByEdgeId.set(edge.id, FALSE_COLOR);
      }
    });
  });

  return graphEdges.map((edge) => {
    const stroke = colorByEdgeId.get(edge.id);
    if (!stroke) {
      return edge;
    }

    const strokeWidth = edge.label === 'True' || edge.label === 'False' ? 4 : 3;

    return {
      ...edge,
      style: {
        ...(edge.style || {}),
        stroke,
        strokeWidth,
      },
      labelStyle: {
        ...(edge.labelStyle || {}),
        fill: stroke,
        fontWeight: 900,
      },
    };
  });
};

function App() {
  const [code, setCode] = useState(examples.ifElse);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [complexity, setComplexity] = useState(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // Pipeline state
  const [tac, setTac] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const graphPanelRef = useRef(null);
  const sidebarResizeStateRef = useRef({ startX: 0, startWidth: 400 });

  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const minWidth = 280;
      const maxWidth = Math.min(980, window.innerWidth - 260);
      const deltaX = event.clientX - sidebarResizeStateRef.current.startX;
      const nextWidth = sidebarResizeStateRef.current.startWidth + deltaX;

      setSidebarWidth(Math.min(Math.max(nextWidth, minWidth), maxWidth));
    };

    const handlePointerUp = () => {
      setIsResizingSidebar(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizingSidebar]);

  const resetWorkflow = () => {
    setCurrentStage(0);
    setTac([]);
    setLeaders([]);
    setBlocks([]);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setComplexity(null);
  };

  const compileSource = (sourceCode) => {
    // Step 1: Lexical Pre-processing
    const lines = parseCode(sourceCode);

    // Step 2: Intermediate Code Generation (TAC)
    const newTac = generateTAC(lines);
    setTac(newTac);

    // Step 3: Leader Identification
    const newLeaders = identifyLeaders(newTac);
    setLeaders(newLeaders);

    // Step 4: Basic Block Formation
    const newBlocks = formBasicBlocks(newTac, newLeaders);
    setBlocks(newBlocks);

    // Step 5: CFG Construction
    const { nodes: newNodes, edges: newEdges } = buildCFGFromBlocks(newBlocks, newTac);
    setNodes(newNodes);
    setEdges(colorizeIndependentEdges(newNodes, newEdges));

    // Step 6: Cyclomatic Complexity
    setComplexity(calculateCyclomaticComplexity(newNodes, newEdges));

    setCurrentStage(1);
  };

  const loadExample = (type) => {
    const exampleCode = examples[type];
    setCode(exampleCode);
    resetWorkflow();
  };

  const handleStartCompilation = () => {
    compileSource(code);
  };

  const handleNextStage = () => {
    setCurrentStage((previousStage) => Math.min(previousStage + 1, totalStages));
  };

  const renderStageCard = (stageNumber, title, status, body, showNextButton = true) => {
    if (currentStage < stageNumber) {
      return null;
    }

    const isCurrentStage = currentStage === stageNumber;

    return (
      <section className={`stage-card ${isCurrentStage ? 'stage-card--current' : 'stage-card--complete'}`}>
        <div className="stage-card__header">
          <div>
            <p className="stage-card__eyebrow">Stage {stageNumber}</p>
            <h3>{title}</h3>
          </div>
          {isCurrentStage ? (
            <span className="stage-card__badge">Active</span>
          ) : (
            <span className="stage-card__badge stage-card__badge--done">Done</span>
          )}
        </div>
        <p className="stage-status">{status}</p>
        <div className="stage-card__body">{body}</div>
        {isCurrentStage && showNextButton ? (
          <button className="stage-next-btn" onClick={handleNextStage}>
            Next →
          </button>
        ) : null}
      </section>
    );
  };

  const renderEdgeList = () => {
    if (edges.length === 0) {
      return <div className="empty-state">No control-flow edges were generated for this program.</div>;
    }

    return (
      <div className="edges-list">
        {edges.map((edge) => (
          <div key={edge.id} className="edge-item">
            <span className="edge-item__route">
              {edge.source} → {edge.target}
            </span>
            <span className="edge-item__label">{edge.label || 'Sequential'}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-section">
          <h1>CFG Visualizer</h1>
          <p className="header-subtitle">A step-by-step compiler simulation</p>
        </div>
        <div className="metrics-section">
          <div className="complexity-badge">
            <span className="label">Cyclomatic Complexity:</span>
            <span className="value">{currentStage >= totalStages && complexity !== null ? complexity : 'Pending'}</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <div className="samples-section">
            <label className="editor-label">Quick Samples</label>
            <div className="samples-grid">
              <button onClick={() => loadExample('sequential')}>Sequential</button>
              <button onClick={() => loadExample('ifElse')}>If Else</button>
              <button onClick={() => loadExample('whileLoop')}>While Loop</button>
              <button onClick={() => loadExample('complex')}>Complex</button>
            </div>
          </div>

          <div className="editor-section">
            <label className="editor-label">Source Code</label>
            <textarea
              className="code-textarea"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (currentStage > 0) {
                  resetWorkflow();
                }
              }}
              placeholder="Paste your code here..."
              spellCheck="false"
            />
            <button className="generate-btn" onClick={handleStartCompilation}>
              Start Compilation
            </button>
          </div>

          <div className="pipeline-timeline">
            {currentStage === 0 ? (
              <div className="timeline-placeholder">
                Start compilation to reveal each compiler stage one at a time.
              </div>
            ) : null}

            {renderStageCard(
              1,
              'Generate Three Address Code (TAC)',
              'Generating Intermediate Code...',
              <div className="code-display">
                {tac.length > 0 ? tac.map((t) => (
                  <div key={t.line} className="code-line">
                    <span className="line-num">{t.line}:</span> {t.text}
                  </div>
                )) : <div className="empty-state">No TAC generated.</div>}
              </div>
            )}

            {renderStageCard(
              2,
              'Leader Identification',
              'Identifying Leaders...',
              <div className="leaders-display">
                {leaders.length > 0 ? leaders.join(', ') : 'No leaders identified.'}
              </div>
            )}

            {renderStageCard(
              3,
              'Basic Block Formation',
              'Forming Basic Blocks...',
              <div className="blocks-list">
                {blocks.length > 0 ? blocks.map((b) => (
                  <div key={b.id} className="block-item">
                    <span className="block-id">{b.id}</span>
                    <div className="block-info">
                      <span className="block-range">Lines {b.range}</span>
                      <pre className="block-content">
                        {b.instructions.map((i) => `${i.line}: ${i.text}`).join('\n')}
                      </pre>
                    </div>
                  </div>
                )) : <div className="empty-state">No basic blocks formed.</div>}
              </div>
            )}

            {renderStageCard(
              4,
              'Edge Construction',
              'Constructing Control Flow Edges...',
              renderEdgeList()
            )}

            {renderStageCard(
              5,
              'CFG Visualization',
              'Rendering the control-flow graph...',
              <div className="stage-visual-note">The graph is rendered in the visualization panel on the right.</div>
            )}

            {renderStageCard(
              6,
              'Cyclomatic Complexity',
              'Calculating cyclomatic complexity...',
              <div className="complexity-panel">
                <div className="formula-line">V(G) = E - N + 2P</div>
                <div className="formula-line">V(G) = {edges.length} - {nodes.length} + 2 × 1</div>
                <div className="formula-result">Result: {complexity}</div>
              </div>,
              false
            )}
          </div>
        </aside>

        <div
          className={`sidebar-resizer ${isResizingSidebar ? 'sidebar-resizer--active' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={(event) => {
            event.preventDefault();
            sidebarResizeStateRef.current = {
              startX: event.clientX,
              startWidth: sidebarWidth,
            };
            setIsResizingSidebar(true);
          }}
          onDoubleClick={() => {
            setSidebarWidth((prevWidth) => (prevWidth < 460 ? 620 : 400));
          }}
        />

        <section className="graph-area">
          {currentStage >= 5 ? (
            <div className="graph-stage" ref={graphPanelRef}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                zoomOnScroll
                zoomOnPinch
                panOnScroll={false}
                minZoom={0.25}
                maxZoom={2.75}
              >
                <FastZoomLayer containerRef={graphPanelRef} />
                <Background color="#f3c64f" gap={16} />
                <Controls />
                <MiniMap
                  nodeColor="#f97316"
                  maskColor="rgba(255, 248, 235, 0.7)"
                  style={{ background: '#fff8ec' }}
                />
              </ReactFlow>
            </div>
          ) : (
            <div className="graph-placeholder">
              <div className="graph-placeholder__title">CFG Visualization</div>
              <div className="graph-placeholder__text">
                The graph appears in Stage 5 after edges are constructed.
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
