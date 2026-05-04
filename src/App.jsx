import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

import { parseCode, buildCFG, calculateCyclomaticComplexity } from './parser';
import { Handle, Position } from 'reactflow';

// Custom Statement Node (Rectangle)
const StatementNode = ({ data }) => (
  <div className="custom-node statement-node">
    <Handle type="target" position={Position.Top} />
    <div className="node-content">{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

// Custom Condition Node (Diamond-like)
const ConditionNode = ({ data }) => (
  <div className="custom-node condition-node">
    <Handle type="target" position={Position.Top} />
    <div className="diamond-container">
      <div className="node-content">{data.label}</div>
    </div>
    <Handle type="source" position={Position.Bottom} />
    <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0 }} />
    <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
  </div>
);

const nodeTypes = {
  statement: StatementNode,
  condition: ConditionNode,
};

const initialNodes = [];
const initialEdges = [];

const examples = {
  sequential: 'x = 10;\ny = 20;\nz = x + y;\nconsole.log(z);',
  ifElse: 'a = 15;\nif(a > 10){\n  status = "Pass";\n}\nelse{\n  status = "Fail";\n}\nprint(status);',
  whileLoop: 'count = 0;\nwhile(count < 5){\n  count = count + 1;\n  print(count);\n}\ndone = true;',
  complex: 'i = 0;\nsum = 0;\nif(mode == "sum"){\n  while(i < 10){\n    sum = sum + i;\n    i = i + 1;\n  }\n}\nelse{\n  sum = -1;\n}\nreturn sum;'
};

function App() {
  const [code, setCode] = useState(examples.ifElse);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [complexity, setComplexity] = useState(0);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const generateCFG = (sourceCode) => {
    const lines = parseCode(sourceCode);
    const { nodes: newNodes, edges: newEdges } = buildCFG(lines);
    setNodes(newNodes);
    setEdges(newEdges);
    setComplexity(calculateCyclomaticComplexity(newNodes, newEdges));
  };

  const loadExample = (type) => {
    const exampleCode = examples[type];
    setCode(exampleCode);
    generateCFG(exampleCode);
  };

  const handleGenerateCFG = () => {
    generateCFG(code);
  };

  useEffect(() => {
    generateCFG(examples.ifElse);
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-section">
          <h1>CFG Visualizer</h1>
        </div>
        <div className="metrics-section">
          <div className="complexity-badge">
            <span className="label">Cyclomatic Complexity:</span>
            <span className="value">{complexity}</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
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
            <label className="editor-label">Input Code</label>
            <textarea
              className="code-textarea"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here..."
              spellCheck="false"
            />
            <button className="generate-btn" onClick={handleGenerateCFG}>
              Generate CFG
            </button>
          </div>

          <div className="blocks-section">
            <label className="editor-label">Basic Blocks</label>
            <div className="blocks-list">
              {nodes.map((node, i) => (
                <div key={node.id} className="block-item">
                  <span className="block-id">B{i + 1}</span>
                  <div className="block-content">{node.data.label}</div>
                </div>
              ))}
              {nodes.length === 0 && (
                <div className="empty-state">No blocks identified yet.</div>
              )}
            </div>
          </div>
        </aside>

        <section className="graph-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#334155" gap={16} />
            <Controls />
            <MiniMap 
              nodeColor="#38bdf8"
              maskColor="rgba(15, 23, 42, 0.6)"
              style={{ background: '#1e293b' }}
            />
          </ReactFlow>
        </section>
      </main>
    </div>
  );
}

export default App;
