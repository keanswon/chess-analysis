import ChessPage from "./chess/chessBoard";

export default function Home() {
  return (
    <div className="flex flex-col items-center space-y-4 justify-center h-screen">
        <ChessPage />
    </div>
  );
}
