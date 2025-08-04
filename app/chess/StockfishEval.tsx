// components/StockfishEval.tsx
'use client';

import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';

interface StockfishEvaluation {
  evaluation: number | string | null;
  bestMove: string;
  principalVariation: string[];
  depth: number;
  nodes: number;
  time: number;
  nps?: number;
}

interface StockfishEvalProps {
  fen?: string;
  autoEvaluate?: boolean;
  depth?: number;
  className?: string;
}

interface ApiError {
  error: string;
}

export function StockfishEval({ 
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  autoEvaluate = true,
  depth = 18,
  className = ""
}: StockfishEvalProps) {
  const [evaluation, setEvaluation] = useState<StockfishEvaluation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fen && autoEvaluate) {
      evaluatePosition(fen);
    }
  }, [fen, autoEvaluate, depth]);

  const evaluatePosition = async (fenString: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/stockfish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fen: fenString, depth })
      });

      const data: StockfishEvaluation = await response.json();

      setEvaluation(data as StockfishEvaluation);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatEvaluation = (evaluation: number | string | null): string => {
    if (evaluation === null || evaluation === undefined) return '0.00';
    
    // for evals where forced mate is on the board
    if (typeof evaluation === 'string' && evaluation.startsWith('M')) {
      return evaluation;
    }
    
    const numEval = parseFloat(evaluation.toString());
    if (isNaN(numEval)) return '0.00';
    
    if (numEval > 0) return `+${numEval.toFixed(2)}`;
    if (numEval < 0) return numEval.toFixed(2);
    return '0.00';
  };

  const getEvaluationColorClass = (evaluation: number | string | null): string => {
    if (evaluation === null || evaluation === undefined) return 'text-white';
    
    if (typeof evaluation === 'string' && evaluation.startsWith('M')) {
      return evaluation.includes('-') ? 'text-black-400' : 'text-white';
    }
    
    const numEval = parseFloat(evaluation.toString());
    if (isNaN(numEval)) return 'text-white';
    
    if (numEval > 0) return 'text-white';
    if (numEval < 0) return 'text-black-400';
    return 'text-white';
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatTime = (timeMs: number): string => {
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(1)}s`;
  };

  // Loading State
  if (loading) {
    return (
      <div className={`stockfish-eval ${className}`}>
        <div className="animate-pulse bg-gray-400 rounded-xl p-4 border border-gray-500 min-w-72">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-400 text-xs font-medium">ANALYZING...</span>
            </div>
            <div className="w-16 h-3 bg-gray-500 rounded"></div>
          </div>
          <div className="w-20 h-8 bg-gray-700 rounded mb-3"></div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-gray-500 rounded"></div>
            <div className="w-full h-12 bg-gray-500 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className={`stockfish-eval ${className}`}>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 min-w-72">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Analysis Error</span>
          </div>
          <p className="text-red-300 text-sm mb-3">{error}</p>
          <button 
            onClick={() => evaluatePosition(fen)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Convert best move from UCI to SAN
  let bestMoveSAN = evaluation?.bestMove || 'N/A';
  if (evaluation?.bestMove && fen) {
    try {
      const chess = new Chess(fen);
      const moveObj = chess.move({ from: evaluation.bestMove.slice(0,2), to: evaluation.bestMove.slice(2,4), promotion: evaluation.bestMove.slice(4) });
      if (moveObj && moveObj.san) {
        bestMoveSAN = moveObj.san;
      }
    } catch {}
  }

  // Main Evaluation Display
  return (
    <div className={`stockfish-eval ${className}`}>
      <div className="bg-gradient-to-br from-gray-600 to-gray-500 rounded-xl p-4 border border-gray-400 shadow-lg min-w-72">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-400 text-xs font-medium tracking-wide">STOCKFISH</span>
          </div>
          <div className="text-black-500 text-xs">
            Depth {evaluation?.depth || 0}
          </div>
        </div>

        {/* Evaluation Score */}
        <div className="mb-4">
          <div className={`text-3xl font-bold mb-1 ${getEvaluationColorClass(evaluation?.evaluation || null)}`}>
            {formatEvaluation(evaluation?.evaluation || null)}
          </div>
          {evaluation && evaluation.time > 0 && (
            <div className="text-black-500 text-xs space-x-2">
              <span>{formatNumber(evaluation.nodes)} nodes</span>
              <span>•</span>
              <span>{formatTime(evaluation.time)}</span>
              {evaluation.nps && (
                <>
                  <span>•</span>
                  <span>{formatNumber(evaluation.nps)} nps</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Best Move */}
        <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
          <div className="text-gray-400 text-xs font-medium mb-1">BEST MOVE</div>
          <div className="text-white font-mono text-sm">
            {bestMoveSAN}
          </div>
        </div>

        {/* Principal Variation */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-gray-400 text-xs font-medium mb-1">PRINCIPAL VARIATION</div>
          <div className="text-gray-300 font-mono text-xs leading-relaxed break-all">
            {evaluation?.principalVariation && evaluation.principalVariation.length > 0 
              ? evaluation.principalVariation.join(' ')
              : 'N/A'
            }
          </div>
        </div>

        {/* Manual Evaluate Button */}
        {!autoEvaluate && (
          <button
            onClick={() => evaluatePosition(fen)}
            disabled={loading}
            className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing...' : 'Analyze Position'}
          </button>
        )}
      </div>
    </div>
  );
}

// Alternative function that returns a div element (for your original request)
export async function createStockfishEvalDiv(fen?: string): Promise<HTMLDivElement> {
  try {
    const response = await fetch('/api/stockfish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        fen: fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" 
      })
    });

    const data: StockfishEvaluation | ApiError = await response.json();

    if (!response.ok) {
      const errorData = data as ApiError;
      throw new Error(errorData.error);
    }

    const evaluation = data as StockfishEvaluation;
    
    // Create the div element with Tailwind-equivalent styles
    const div = document.createElement('div');
    div.className = 'stockfish-evaluation bg-gradient-to-br from-gray-400 to-gray-600 text-white p-4 rounded-xl border border-gray-700 shadow-lg';
    div.style.minWidth = '280px';
    div.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    // Format evaluation
    let evalDisplay = evaluation.evaluation?.toString() || '0.00';
    let evalColorClass = 'text-white';
    
    if (typeof evaluation.evaluation === 'string' && evaluation.evaluation.startsWith('M')) {
      evalColorClass = evaluation.evaluation.includes('-') ? 'text-red-400' : 'text-green-400';
    } else if (evaluation.evaluation !== null && evaluation.evaluation !== undefined) {
      const numEval = parseFloat(evaluation.evaluation.toString());
      if (!isNaN(numEval)) {
        if (numEval > 0) {
          evalColorClass = 'text-green-400';
          evalDisplay = `+${numEval.toFixed(2)}`;
        } else if (numEval < 0) {
          evalColorClass = 'text-red-400';
          evalDisplay = numEval.toFixed(2);
        } else {
          evalDisplay = '0.00';
        }
      }
    }
    
    console.log(evaluation);
    
    div.innerHTML = `
      <!-- Header -->
      <div class="flex justify-between items-center mb-3">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
          <span class="text-gray-400 text-xs font-medium tracking-wide">STOCKFISH</span>
        </div>
        <span class="text-gray-500 text-xs">Depth ${evaluation.depth}</span>
      </div>
      
      <!-- Evaluation Score -->
      <div class="mb-4">
        <div class="text-3xl font-bold mb-1 ${evalColorClass}">
          ${evalDisplay}
        </div>
        ${evaluation.time > 0 ? `
          <div class="text-gray-500 text-xs space-x-2">
            <span>${evaluation.nodes.toLocaleString()} nodes</span>
            <span>•</span>
            <span>${evaluation.time < 1000 ? evaluation.time + 'ms' : (evaluation.time / 1000).toFixed(1) + 's'}</span>
            ${evaluation.nps ? `
              <span>•</span>
              <span>${evaluation.nps >= 1000000 ? (evaluation.nps / 1000000).toFixed(1) + 'M' : (evaluation.nps / 1000).toFixed(1) + 'K'} nps</span>
            ` : ''}
          </div>
        ` : ''}
      </div>
      
      <!-- Best Move -->
      <div class="bg-gray-800/50 rounded-lg p-3 mb-3">
        <div class="text-gray-400 text-xs font-medium mb-1">BEST MOVE</div>
        <div class="text-white font-mono text-sm">${evaluation.bestMove || 'N/A'}</div>
      </div>
      
      <!-- Principal Variation -->
      <div class="bg-gray-800/50 rounded-lg p-3">
        <div class="text-gray-400 text-xs font-medium mb-1">PRINCIPAL VARIATION</div>
        <div class="text-gray-300 font-mono text-xs leading-relaxed break-all">
          ${evaluation.principalVariation.length > 0 ? evaluation.principalVariation.join(' ') : 'N/A'}
        </div>
      </div>
    `;
    
    return div;
    
  } catch (error) {
    // Return error div
    const errorDiv = document.createElement('div');
    errorDiv.className = 'stockfish-evaluation bg-red-900/20 border border-red-500/50 rounded-xl p-4 min-w-72';
    errorDiv.innerHTML = `
      <div class="flex items-center gap-2 text-red-400 mb-2">
        <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span class="text-sm font-medium">Analysis Error</span>
      </div>
      <p class="text-red-300 text-sm">${error instanceof Error ? error.message : 'Failed to evaluate position'}</p>
    `;
    throw errorDiv;
  }
}