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

    // Split movePairs into chunks of 10 for columns
    const chunkSize = 10;
    const columns = [];
    for (let i = 0; i < movePairs.length; i += chunkSize) {
        columns.push(movePairs.slice(i, i + chunkSize));
    }

    return (
        <div className="bg-gradient-to-br from-gray-600 to-gray-500 rounded-xl p-4 border border-gray-400 shadow-lg min-w-72">
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-400 text-xs font-medium tracking-wide">MOVE HISTORY</span>
                </div>
                <div className="text-black-500 text-xs">
                    {history.length} moves
                </div>
            </div>

            {/* Move History Content */}
            <div className="bg-gray-800/50 rounded-lg p-3 h-66 overflow-y-auto">
                {history.length === 0 ? (
                    <div className="text-gray-400 text-sm">No moves played yet.</div>
                ) : (
                    <div className="flex flex-row gap-6">
                        {columns.map((col, colIdx) => (
                            <div key={colIdx} className="space-y-1">
                                {col.map(({ white, black, moveNumber }) => (
                                    <div key={moveNumber} className="flex items-center space-x-2 text-sm">
                                        <span className="text-gray-400 font-mono w-6">{moveNumber}.</span>
                                        <span className="text-white font-mono">{white}</span>
                                        {black && <span className="text-gray-300 font-mono">{black}</span>}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}