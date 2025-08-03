// app/api/stockfish/route.ts (or pages/api/stockfish.ts for Pages Router)
import { spawn, ChildProcess } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';

interface StockfishEvaluation {
  evaluation: number | string | null;
  bestMove: string;
  principalVariation: string[];
  depth: number;
  nodes: number;
  time: number;
  nps?: number; // nodes per second
}

interface EvaluationRequest {
  fen: string;
  depth?: number;
  timeLimit?: number;
}

interface ApiError {
  error: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<StockfishEvaluation | ApiError>> {
  try {
    const body: EvaluationRequest = await request.json();
    const { fen, depth = 18, timeLimit = 10000 } = body;

    const evaluation = await evaluatePosition(fen, depth, timeLimit);
    return NextResponse.json(evaluation);
    
  } catch (error) {
    console.error('Stockfish evaluation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Evaluation failed' 
    }, { status: 500 });
  }
}

function evaluatePosition(fen: string, depth: number, timeLimit: number): Promise<StockfishEvaluation> {
  return new Promise((resolve, reject) => {
    // Update this path to your Stockfish binary location
    const stockfishPath = process.platform === 'darwin' 
      ? '/opt/homebrew/bin/stockfish'  // macOS with Homebrew
      : process.platform === 'win32'
      ? 'stockfish.exe'               // Windows
      : '/usr/local/bin/stockfish';   // Linux or custom install
    
    let stockfish: ChildProcess;
    
    try {
      stockfish = spawn(stockfishPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      reject(new Error(`Failed to start Stockfish: ${error}`));
      return;
    }

    let output = '';
    const result: StockfishEvaluation = {
      evaluation: null,
      bestMove: '',
      principalVariation: [],
      depth: depth,
      nodes: 0,
      time: 0
    };

    const timeout = setTimeout(() => {
      stockfish.kill('SIGTERM');
      reject(new Error('Stockfish evaluation timeout'));
    }, timeLimit);

    stockfish.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
      const lines = output.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('info') && line.includes('depth')) {
          parseInfoLine(line, result);
        }
        
        if (line.startsWith('bestmove')) {
          const match = line.match(/bestmove (\w+)/);
          if (match) {
            result.bestMove = match[1];
          }
          
          // Calculate nodes per second
          if (result.time > 0) {
            result.nps = Math.round(result.nodes / (result.time / 1000));
          }
          
          clearTimeout(timeout);
          stockfish.kill('SIGTERM');
          resolve(result);
          return;
        }
      }
    });

    stockfish.stderr?.on('data', (data: Buffer) => {
      console.error('Stockfish stderr:', data.toString());
    });

    stockfish.on('error', (error: Error) => {
      clearTimeout(timeout);
      reject(new Error(`Stockfish process error: ${error.message}`));
    });

    stockfish.on('close', (code: number | null) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        reject(new Error(`Stockfish exited with code ${code}`));
      }
    });

    // Send UCI commands
    try {
      stockfish.stdin?.write('uci\n');
      stockfish.stdin?.write('isready\n');
      stockfish.stdin?.write(`position fen ${fen}\n`);
      stockfish.stdin?.write(`go depth ${depth}\n`);
    } catch (error) {
      clearTimeout(timeout);
      stockfish.kill('SIGTERM');
      reject(new Error('Failed to communicate with Stockfish'));
    }
  });
}

function parseInfoLine(line: string, result: StockfishEvaluation): void {
  // Parse depth
  const depthMatch = line.match(/depth (\d+)/);
  if (depthMatch) {
    result.depth = parseInt(depthMatch[1], 10);
  }
  
  // Parse nodes
  const nodesMatch = line.match(/nodes (\d+)/);
  if (nodesMatch) {
    result.nodes = parseInt(nodesMatch[1], 10);
  }
  
  // Parse time
  const timeMatch = line.match(/time (\d+)/);
  if (timeMatch) {
    result.time = parseInt(timeMatch[1], 10);
  }
  
  // Parse centipawn evaluation
  if (line.includes('score cp')) {
    const match = line.match(/score cp (-?\d+)/);
    if (match) {
      result.evaluation = parseInt(match[1], 10) / 100;
    }
  }
  
  // Parse mate scores
  if (line.includes('score mate')) {
    const match = line.match(/score mate (-?\d+)/);
    if (match) {
      result.evaluation = `M${match[1]}`;
    }
  }
  
  // Parse principal variation
  if (line.includes('pv ')) {
    const pvMatch = line.match(/pv (.+)/);
    if (pvMatch) {
      result.principalVariation = pvMatch[1].split(' ').slice(0, 6);
    }
  }
}