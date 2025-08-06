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
  fen?: string; // side to move for evaluation perspective
}

interface EvaluationRequest {
  fen: string;
  depth?: number;
  timeLimit?: number;
}

interface ApiError {
  error: string;
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
  const stockfishPath = process.platform === 'darwin'
    ? '/opt/homebrew/bin/stockfish'
    : process.platform === 'win32'
    ? 'stockfish.exe'
    : '/usr/local/bin/stockfish';

  let stockfish: ChildProcess;
  try {
    stockfish = spawn(stockfishPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error) {
    controller.enqueue(JSON.stringify({ error: `Failed to start Stockfish: ${error}` }) + '\n');
    controller.close();
    return;
  }

  let output = '';
  let lastDepth = 0;
  let finished = false;
  // Always keep the latest info line's evaluation
  const result: StockfishEvaluation & { fen?: string } = {
    evaluation: null,
    bestMove: '',
    principalVariation: [],
    depth: 0,
    nodes: 0,
    time: 0,
    fen // add fen to result for perspective correction
  };

  const timeout = setTimeout(() => {
    if (!finished) {
      stockfish.kill('SIGTERM');
      controller.enqueue(JSON.stringify({ error: 'Stockfish evaluation timeout' }) + '\n');
      controller.close();
    }
  }, timeLimit);

  stockfish.stdout?.on('data', (data: Buffer) => {
    output += data.toString();
    const lines = output.split('\n');
    output = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('info') && line.includes('depth')) {
        // Always update the result object with the latest info
        parseInfoLine(line, result);
        // Only send new depth updates
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
        stockfish.kill('SIGTERM');
        return;
      }
    }
  });

  stockfish.stderr?.on('data', (data: Buffer) => {
    console.error('Stockfish stderr:', data.toString());
  });

  stockfish.on('error', (error: Error) => {
    clearTimeout(timeout);
    controller.enqueue(JSON.stringify({ error: `Stockfish process error: ${error.message}` }) + '\n');
    controller.close();
  });

  stockfish.on('close', (code: number | null) => {
    clearTimeout(timeout);
    if (!finished && code !== 0 && code !== null) {
      controller.enqueue(JSON.stringify({ error: `Stockfish exited with code ${code}` }) + '\n');
      controller.close();
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