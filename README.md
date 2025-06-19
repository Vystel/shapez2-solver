# Shapez 2 Solver

This web-based tool helps you find the most efficient sequence of operations to construct a **Target Shape** in the game Shapez 2, using a given set of **Starting Shapes** and **Enabled Operations**.

The solver uses a **Breadth-First Search (BFS) algorithm** to explore possible combinations of operations and finds the shortest path to your desired shape.

---

### How to Use

1.  **Enter Target Shape:** In the "Target Shape" field, input the shape code you wish to create (e.g., `CuCuCuCu:SuSuSuSu`). Hex shapes are supported!
2.  **Add Starting Shapes:** Under "Starting Shapes," type in the shape codes of the shapes you have available and click the `+` button to add them. You can remove shapes by clicking the `×` next to them.
3.  **Enable Operations:** Check the boxes next to the operations you want the solver to consider.
4.  **Solve:** Click the "Solve" button. The solver will begin processing. (Website will freeze!)
5.  **View Solution:** If a solution is found, the steps will be displayed as a string and visualized in the graph area.

---

### Note:

This website is in beta and may be unstable. Calculations can take a while, try to remove unnecessary starting shapes and operations.