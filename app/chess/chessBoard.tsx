'use client'

import { useState, useRef, useEffect, Key } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChessMoves } from './chessMoves';
import { Icon } from './icons';
import { Textarea } from '@/components/ui/textarea';


interface PieceDropHandlerArgs {
    sourceSquare: string;
    targetSquare: string;
}

export default function ChessPage(pgn?: string) {
    const chessGameRef = useRef<Chess>(new Chess());
    const chessGame = chessGameRef.current;

    const [fens, setFen] = useState([chessGameRef.current.fen()])
    const [step, setStep] = useState(0);
    const [chessPosition, setChessPosition] = useState(chessGame.fen());

    useEffect(() => {
        const game = chessGameRef.current

        if (pgn && typeof pgn === 'string' && pgn.trim() !== '') {
            game.loadPgn(pgn)

        } else {
            game.reset()
        }
        
        const list = [new Chess().fen()];

        game.history().forEach(move => {
            game.move(move);
            list.push(game.fen());
        });

        setFen(list);
        setStep(list.length - 1)
    }, [pgn])

    useEffect(() => {
        setChessPosition(fens[step])
    }, [step, fens])

    useEffect(() => {
        const onKey= (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                setStep(i => Math.max(i - 1, 0));
                console.log('left arrow pressed', 'step:', step);
            }
            if (e.key == 'ArrowRight') {
                setStep(i => Math.min(i + 1, fens.length - 1));
                console.log('right arrow pressed', 'step:', step);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
        }
    }, [fens.length]);
            
    
    function onPieceDrop({
            sourceSquare, 
            targetSquare 
        }: PieceDropHandlerArgs) {
        try {
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

    const chessboardOptions = {
        position: chessPosition,
        onPieceDrop,
        id: 'play-vs-random',
    };

    return (
        <div className="flex flex-row space-x-10 justify-center">
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
                    <Icon   name="smojfarf"
                            rating={2500}
                            isWhite={false}/>
                    <div className="w-96 h-96">
                        <Chessboard options={chessboardOptions} />
                    </div>
                    <Icon   name="smojfarf"
                            rating={2500}
                            isWhite={true}/>

                    <div className="flex spaxe-x-4 justify-center p-4">
                        <Textarea className='w-96 h-32 mr-3'
                        placeholder="PGN string"
                        value={chessGame.pgn()}
                        onChange={(e) => {
                            const pgn = e.target.value;
                            chessGame.loadPgn(pgn);
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

            <div className="flex-shrink-0 h-96 overflow-y-auto">
                <ChessMoves 
                    history={chessGame.history()}
                    currentMoveIndex={chessGame.history().length - 1} />
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