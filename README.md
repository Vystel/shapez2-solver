# Shapez 2 Solver

This web-based tool helps you find the most efficient sequence of operations to construct a **Target Shape** in the game Shapez 2, using a given set of **Starting Shapes** and **Enabled Operations**.

The solver uses a **Breadth-First Search (BFS) algorithm** to explore possible combinations of operations and finds the shortest path to your desired shape.

---

### Note:

This website is in beta and may be unstable. Calculations can take a while, try to remove unnecessary starting shapes and operations.

---

### How to Use

1.  Enter the shape code you want to make in the "Target Shapes" box. Hex shapes are supported!
2.  Type the codes of the shapes you want the solver to work with in the "Starting Shapes" box.
3.  To make calculations quicker, uncheck the boxes next to unnecessary operations you don't want the solver to consider.
4.  Once everything is set up, click the "Solve" button. The solver will begin processing. (This can take a while, depending on the complexity of the shape.)
5.  If a solution is found, the steps will be visualized in the graph area. (This will also give you a code you can feed into ShapeBot 2's /operationGraph command.)