import { useState, useEffect } from 'react';

declare global {
  interface Window {
    Stockfish: new () => Worker;
  }
}

interface StockfishEvaluation {
  score: number | string | null;
  bestMove: string;
  pv: string[];
  depth: number;
  nodes: number;
  time: number;
  nps: number;
}

export const useStockfish = () => {
  const [engine, setEngine] = useState<Worker | null>(null);

  useEffect(() => {
    const initializeEngine = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Wait for Stockfish to be loaded
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (!window.Stockfish) {
            console.error('Stockfish not loaded');
            return;
          }

          // Initialize Stockfish WASM
          const worker = new window.Stockfish();
          
          // Wait for engine to be ready
          worker.postMessage('uci');
          worker.postMessage('isready');
          
          setEngine(worker);
        } catch (error) {
          console.error('Error initializing Stockfish:', error);
        }
      }
    };

    initializeEngine();

    return () => {
      if (engine) {
        engine.terminate();
      }
    };
  }, []);

  const evaluatePosition = (fen: string, depth: number = 18): Promise<StockfishEvaluation> => {
    return new Promise((resolve, reject) => {
      if (!engine) {
        reject(new Error('Engine not initialized'));
        return;
      }

      let evaluation: StockfishEvaluation = {
        score: null,
        bestMove: '',
        pv: [],
        depth: 0,
        nodes: 0,
        time: 0,
        nps: 0
      };

      const handleMessage = (e: MessageEvent) => {
        const line = e.data;
        
        if (line.includes('bestmove')) {
          engine.removeEventListener('message', handleMessage);
          resolve(evaluation);
        } else if (line.includes('cp ')) {
          const match = line.match(/cp (-?\d+)/);
          if (match) {
            evaluation.score = parseInt(match[1]) / 100;
          }
        } else if (line.includes('mate ')) {
          const match = line.match(/mate (-?\d+)/);
          if (match) {
            evaluation.score = `M${match[1]}`;
          }
        }
        
        if (line.includes('pv ')) {
          evaluation.pv = line.split(' pv ')[1].split(' ');
          evaluation.bestMove = evaluation.pv[0];
        }
        
        const depthMatch = line.match(/depth (\d+)/);
        if (depthMatch) {
          evaluation.depth = parseInt(depthMatch[1]);
        }
        
        const nodesMatch = line.match(/nodes (\d+)/);
        if (nodesMatch) {
          evaluation.nodes = parseInt(nodesMatch[1]);
        }
        
        const timeMatch = line.match(/time (\d+)/);
        if (timeMatch) {
          evaluation.time = parseInt(timeMatch[1]);
        }
        
        const npsMatch = line.match(/nps (\d+)/);
        if (npsMatch) {
          evaluation.nps = parseInt(npsMatch[1]);
        }
      };

      engine.addEventListener('message', handleMessage);
      
      engine.postMessage('uci');
      engine.postMessage('isready');
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage(`go depth ${depth}`);
    });
  };

  return { engine, evaluatePosition };
};
