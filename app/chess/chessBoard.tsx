'use client'

import { useState, useRef, useEffect, Key } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { Button } from '@/components/ui/button';
import { ChessMoves } from './chessMoves';
import { Icon } from './icons';
import { Textarea } from '@/components/ui/textarea';
import { StockfishEval } from '@/app/chess/StockfishEval';


interface PieceDropHandlerArgs {
    piece: any;  // Using any for piece type since it's a complex type from react-chessboard
    sourceSquare: string;
    targetSquare: string | null;
}

export default function ChessPage(pgn?: string) {
    const chessGameRef = useRef<Chess>(new Chess());
    const chessGame = chessGameRef.current;

    const [fens, setFen] = useState([chessGameRef.current.fen()])
    const [step, setStep] = useState(0);
    const [pgnstring, setPGN] = useState<string>("");
    const [whitePlayer, setWhitePlayer] = useState({ name: "", rating: 100 });
    const [blackPlayer, setBlackPlayer] = useState({ name: "", rating: 100 });
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        // Reset the game first
        chessGame.reset();
        
        // If the PGN string is empty, just set the initial position
        if (!pgnstring.trim()) {
            setFen([chessGame.fen()]);
            setStep(0);
            return;
        }
        
        try {
            // Attempt to load the PGN and log for debugging
            chessGame.loadPgn(pgnstring);
            
            // Extract player information from PGN headers
            const headers = chessGame.header();
            setWhitePlayer({
                name: headers['White'] || "",
                rating: headers['WhiteElo'] ? parseInt(headers['WhiteElo']) : 0
            });
            setBlackPlayer({
                name: headers['Black'] || "",
                rating: headers['BlackElo'] ? parseInt(headers['BlackElo']) : 0
            });
        } catch (e) {
            console.error('Error loading PGN:', e);
            // Reset the game on error
            chessGame.reset();
            setFen([chessGame.fen()]);
            setStep(0);
            return;
        }       

        // Store the history first
        const moveHistory = chessGame.history();
        // Reset the game to start position
        chessGame.reset();
        
        // Initialize FEN history with the starting position
        const historyFens = [chessGame.fen()];
        
        // Replay each move on the fresh board
        moveHistory.forEach(move => {
            chessGame.move(move);
            historyFens.push(chessGame.fen());
        });

        setFen(historyFens);
        setStep(historyFens.length - 1)
    }, [pgnstring])

    useEffect(() => {
        const onKey= (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                setStep(i => Math.max(i - 1, 0));
            }
            if (e.key == 'ArrowRight') {
                setStep(i => Math.min(i + 1, fens.length - 1));
            }
        }
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
        }
    }, [fens.length]);

    function isValidPGN(pgn: string): boolean {
        const chess = new Chess();
        try {
            // loadPgn throws an exception if the PGN is syntactically invalid
            chess.loadPgn(pgn);
            return true;
        } catch (e) {
            // you can inspect `e.message` to see what went wrong
            console.warn('Invalid PGN:', e);
            return false;
        }
    }
            
    
    function onPieceDrop({
            sourceSquare, 
            targetSquare,
            piece 
        }: PieceDropHandlerArgs) {
        try {
            // Only process the move if we have a valid target square
            if (!targetSquare) return false;
            
            chessGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q' // always promote to a queen for example simplicity
            });

            setFen(prev => [...prev, chessGame.fen()]);
            setStep(prev => prev + 1);
            
            // make random cpu move after a short delay
            setTimeout(makeRandomMove, 500);

            return true;
        } catch {
            return false;
        }
    }

    function makeRandomMove() {
        if (chessGame.isGameOver()) return;

        const possibleMoves = chessGame.moves();
        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

        // make the move
        chessGame.move(randomMove);

        setFen(prev => [...prev, chessGame.fen()])
        setStep(prev => prev + 1);
    }

    const chessboardOptions: { 
        position: string;
        onPieceDrop: ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs) => boolean;
        id: string;
        boardOrientation: 'white' | 'black';
    } = {
        position: fens[step],
        onPieceDrop,
        id: 'play-vs-random',
        boardOrientation: isFlipped ? 'black' : 'white',
    };

    return (
        <div className="flex flex-row space-x-10 justify-center items-center">

            {/* stockfish component */}
            <StockfishEval 
                fen={fens[step]}
                isFlipped={isFlipped}
                onFlipBoard={() => setIsFlipped(!isFlipped)}
            />

            <div className="flex flex-col items-center">
                {chessGame.isCheckmate() && (
                    <div className="text-red-500 mt-4 text-lg font-semibold">
                        Checkmate!
                    </div>
                )}

                {chessGame.isDraw() && (
                    <div className="text-yellow-500 mt-4 text-lg font-semibold">
                        Draw!
                    </div>
                )}
                
                <div className="space-y-4 flex flex-col justify-center">
                    <Icon   name={blackPlayer.name || "Player"}
                            rating={blackPlayer.rating}
                            isWhite={false}/>
                    <div className="w-96 h-96">
                        <Chessboard options={chessboardOptions} />
                    </div>
                    <Icon   name={whitePlayer.name || "Player"}
                            rating={whitePlayer.rating}
                            isWhite={true}/>
                </div>
            </div>

            <div className="flex-shrink-0 overflow-y-auto">
                <ChessMoves 
                    history={chessGame.history()}
                    currentMoveIndex={chessGame.history().length - 1} />


                <div className="flex spaxe-x-4 justify-center p-4">
                    <Textarea className='w-96 h-32 mr-3'
                    placeholder="PGN string"
                    value={pgnstring}
                    onChange={(e) => {
                        setPGN(e.target.value);
                    }} />

                    <ResetButton 
                        onReset={() => {
                        chessGame.reset();
                        const initialFen = chessGame.fen();
                        setFen([initialFen]);
                        setStep(0);
                    }} />
                </div>
            </div>
        </div>
    )
}


function ResetButton({ onReset }: { onReset: () => void }) {
    
    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            onReset();
        }}>
            <Button type="submit">Reset Board</Button>
        </form>
    );
}   