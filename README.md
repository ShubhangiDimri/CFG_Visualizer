# Control Flow Graph (CFG) Visualizer

A powerful, interactive web application designed for **Compiler Design** students and researchers to visualize source code as a Control Flow Graph. This tool decomposes code into basic blocks, maps execution paths, and calculates cyclomatic complexity in real-time.


## 🚀 Features

- **Static Code Analysis**: Automatically parses JavaScript-like code structures.
- **Support for Control Structures**:
  - **Sequential Execution**: Standard linear statements.
  - **Conditional Branching**: Full support for `if/else` logic with "True" and "False" labeled edges.
  - **Iterative Loops**: Supports `while` loops with animated back-edges.
- **Compiler Metrics**:
  - **Basic Block Identification**: Automatically groups instructions into atomic units.
  - **Cyclomatic Complexity**: Real-time calculation of $M = E - N + 2P$ to determine code complexity.
- **Premium Visualization**:
  - Diamond-shaped condition nodes and rectangular statement nodes.
  - Interactive canvas with Zoom, Pan, and Fit-view.
  - Glassmorphic dark theme for a modern academic feel.
- **Quick Samples**: One-click buttons to load Sequential, Branching, Looping, and Complex examples for easy demonstration.

## 🛠️ Tech Stack

- **Frontend**: React (Vite)
- **Graph Engine**: React Flow
- **Styling**: Vanilla CSS (Custom Design System)
- **Icons**: SVG / CSS

## 📊 Theory & Concepts

### Basic Blocks
In compiler theory, a **Basic Block** is a straight-line code sequence with no branches in except to the entry and no branches out except at the exit. This tool identifies these blocks to simplify the CFG construction.

### Cyclomatic Complexity
This metric measures the number of linearly independent paths through a program's source code. It is calculated using the formula:
**M = E - N + 2**
*   **E**: Number of edges in the graph.
*   **N**: Number of nodes in the graph.
*   A higher value indicates more complex code, requiring more extensive testing coverage.



## 📖 Usage

1. Open the application in your browser.
2. Enter your code in the **Input Code** textarea.
3. Click **Generate CFG** or use one of the **Quick Samples**.
4. Explore the identified **Basic Blocks** and **Cyclomatic Complexity** in the sidebar and header.

