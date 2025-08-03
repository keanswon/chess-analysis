// file for the sidebar that shows the chess 

interface ChessMovesProps {
  history: string[];
  currentMoveIndex?: number;
}
 
export function ChessMoves({ history, currentMoveIndex = 0 }: ChessMovesProps) {
    const movePairs: Array<{ white: string; black: string | null; moveNumber: number }> = [];
    
    for (let i = 0; i < history.length; i += 2) {
        movePairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1] || null
        });
    }

    return (
        <div className="bg-gray-100 border rounded-lg max-w-md p-4 flex flex-col space-y-2 min-w-[200px]">
            <div className="flex justify-center">
                <h2 className="text-lg font-semibold mb-2">Move History</h2>
            </div>
            {history.length === 0 ? (
                <div className="text-gray-500">No moves played yet.</div>
            ) : (
                movePairs.map(({ white, black, moveNumber }) => (
                    <div key={moveNumber} className="flex items-center space-x-2">
                        <span className="text-gray-700">{moveNumber}.</span>
                        <span className="text-black">{white}</span>
                        {black && <span className="text-gray-700"> {black}</span>}
                    </div>
                )))}
        </div>
    );
}