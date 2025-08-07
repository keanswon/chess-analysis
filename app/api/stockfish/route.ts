import { NextRequest, NextResponse } from 'next/server';

interface StockfishEvaluation {
  evaluation: number | string | null;
  bestMove: string;
  principalVariation: string[];
  depth: number;
  nodes: number;
  time: number;
  nps?: number;
  fen?: string;
}

interface EvaluationRequest {
  fen: string;
  depth?: number;
  timeLimit?: number;
}

interface ApiError {
  error: string;
}

// Configure for Edge Runtime
export const runtime = 'edge';

let stockfishInstance: Worker | null = null;

async function initStockfish(): Promise<Worker> {
  if (stockfishInstance) return stockfishInstance;
  
  // Load Stockfish WASM
  const wasmPath = '/stockfish.wasm/stockfish.js';
  const wasmCode = await fetch(new URL(wasmPath, 'https://' + process.env.VERCEL_URL)).then(res => res.text());
  
  // Create a worker with the WASM code
  const workerCode = `
    ${wasmCode}
    self.onmessage = (e) => {
      if (e.data === 'init') {
        self.postMessage('ready');
      } else {
        self.postMessage(e.data);
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  
  // Wait for worker to be ready
  await new Promise<void>((resolve) => {
    worker.onmessage = () => resolve();
    worker.postMessage('init');
  });
  
  stockfishInstance = worker;
  return worker;
}


// Streaming Stockfish analysis as it thinks
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: EvaluationRequest = await request.json();
    const { fen, depth = 18, timeLimit = 10000 } = body;

    const stream = new ReadableStream({
      async start(controller) {
        await evaluatePositionStream(fen, depth, timeLimit, controller);
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Stockfish evaluation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Evaluation failed'
    }, { status: 500 });
  }
}


// Streaming version: sends each info line as JSON to the client as Stockfish thinks
async function evaluatePositionStream(
  fen: string,
  depth: number,
  timeLimit: number,
  controller: ReadableStreamDefaultController
) {
  let stockfish: Worker;
  try {
    stockfish = await initStockfish();
  } catch (error) {
    controller.enqueue(JSON.stringify({ error: `Failed to start Stockfish: ${error}` }) + '\n');
    controller.close();
    return;
  }

  let lastDepth = 0;
  let finished = false;
  const result: StockfishEvaluation = {
    evaluation: null,
    bestMove: '',
    principalVariation: [],
    depth: 0,
    nodes: 0,
    time: 0,
    fen
  };

  const timeout = setTimeout(() => {
    if (!finished) {
      stockfish.terminate();
      controller.enqueue(JSON.stringify({ error: 'Stockfish evaluation timeout' }) + '\n');
      controller.close();
    }
  }, timeLimit);

  // Set up message handler
  stockfish.onmessage = (event) => {
    const line = event.data;
    
    if (line.startsWith('info') && line.includes('depth')) {
      parseInfoLine(line, result);
      if (result.depth > lastDepth) {
        lastDepth = result.depth;
        controller.enqueue(JSON.stringify({ type: 'info', ...result }) + '\n');
      }
    }
    
    if (line.startsWith('bestmove')) {
      const match = line.match(/bestmove (\w+)/);
      if (match) {
        result.bestMove = match[1];
      }
      if (result.time > 0) {
        result.nps = Math.round(result.nodes / (result.time / 1000));
      }
      finished = true;
      clearTimeout(timeout);
      controller.enqueue(JSON.stringify({ type: 'done', ...result }) + '\n');
      controller.close();
      stockfish.terminate();
    }
  };

  stockfish.onerror = (error) => {
    clearTimeout(timeout);
    controller.enqueue(JSON.stringify({ error: `Stockfish error: ${error.message}` }) + '\n');
    controller.close();
    stockfish.terminate();
  };

  // Send UCI commands
  try {
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
  } catch (error) {
    clearTimeout(timeout);
    stockfish.terminate();
    controller.enqueue(JSON.stringify({ error: 'Failed to communicate with Stockfish' }) + '\n');
    controller.close();
  }
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
      let evalCp = parseInt(match[1], 10);
      // Always report from White's perspective
      if (result.fen) {
        const sideToMove = result.fen.split(' ')[1];
        if (sideToMove === 'b') {
          evalCp = -evalCp;
        }
      }
      result.evaluation = evalCp / 100;
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