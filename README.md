# shapez2-solver
A web-based tool to help players of Shapez 2 find a sequence of operations to transform starting shapes into a target shape.

## How to Use
1. Enter your target shape code (e.g., `WuSuRuSu`)
2. Configure which starting shapes you have available to match your in-game resources.
3. Click "Solve" to find a sequence of operations to transform starting shapes into a target shape. For now, this will generate code that can be used to generate a graph using the ShapeBot operation graph command, but this will be integrated into the website in the future.

## Example
Input: `WuSuRuSu`  
Output: `1=RuRuRuRu;2=SuSuSuSu;3=WuWuWuWu;1,2:swap:4,5;4:r90cw:6;3,6:swap:7,8;8:r90cw:9;7,9:swap:10,11`
