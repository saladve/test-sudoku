import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eraser, Pencil, Trophy, Settings } from 'lucide-react';

// -----------------------------------------------------------------------------
// 数独ロジック & ヘルパー関数
// -----------------------------------------------------------------------------

const BLANK = 0;
const GRID_SIZE = 9;

// 新しい空のボードを作成
const getEmptyBoard = () => Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(BLANK));

// 安全に配置できるかチェック (行、列、3x3ブロック)
const isSafe = (board, row, col, num) => {
  // 行のチェック
  for (let x = 0; x < GRID_SIZE; x++) {
    if (board[row][x] === num) return false;
  }
  // 列のチェック
  for (let x = 0; x < GRID_SIZE; x++) {
    if (board[x][col] === num) return false;
  }
  // 3x3ブロックのチェック
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i + startRow][j + startCol] === num) return false;
    }
  }
  return true;
};

// バックトラッキング法で数独を解く（生成に使用）
const solveSudoku = (board) => {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === BLANK) {
        // 1-9の数字をランダムな順序で試す（ランダム性を持たせるため）
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        
        for (let num of nums) {
          if (isSafe(board, row, col, num)) {
            board[row][col] = num;
            if (solveSudoku(board)) return true;
            board[row][col] = BLANK;
          }
        }
        return false;
      }
    }
  }
  return true;
};

// 完成されたボードを生成
const generateFullBoard = () => {
  const board = getEmptyBoard();
  // 最初の行だけランダムに埋めておくと生成が早い＆ランダムになる
  const firstRow = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
  board[0] = firstRow; 
  solveSudoku(board);
  return board;
};

// 穴あきボード（問題）を作成
const generatePuzzle = (difficulty) => {
  const solution = generateFullBoard();
  const puzzle = solution.map(row => [...row]); // コピー作成
  
  // 難易度に応じた空白の数
  let attempts = difficulty === 'Easy' ? 30 : difficulty === 'Medium' ? 45 : 55;
  
  while (attempts > 0) {
    let row = Math.floor(Math.random() * GRID_SIZE);
    let col = Math.floor(Math.random() * GRID_SIZE);
    
    if (puzzle[row][col] !== BLANK) {
      puzzle[row][col] = BLANK;
      attempts--;
    }
  }
  
  return { solution, puzzle };
};

// -----------------------------------------------------------------------------
// React コンポーネント
// -----------------------------------------------------------------------------

export default function App() {
  const [difficulty, setDifficulty] = useState('Easy'); // Easy, Medium, Hard
  const [initialBoard, setInitialBoard] = useState(getEmptyBoard()); // 初期状態（変更不可）
  const [board, setBoard] = useState(getEmptyBoard()); // 現在のボード
  const [solution, setSolution] = useState(getEmptyBoard()); // 正解
  const [selectedCell, setSelectedCell] = useState(null); // [row, col]
  const [memos, setMemos] = useState({}); // { "row-col": [1, 2, 4] }
  const [isMemoMode, setIsMemoMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // 新しいゲームを開始
  const startNewGame = useCallback((diff = difficulty) => {
    const { solution: newSolution, puzzle: newPuzzle } = generatePuzzle(diff);
    setSolution(newSolution);
    setInitialBoard(newPuzzle.map(row => [...row]));
    setBoard(newPuzzle.map(row => [...row]));
    setMemos({});
    setMistakes(0);
    setIsComplete(false);
    setSelectedCell(null);
  }, [difficulty]);

  // 初回ロード時にゲーム開始
  useEffect(() => {
    startNewGame();
  }, []);

  // 数字キーボード入力の処理
  const handleNumberInput = (num) => {
    if (isComplete || !selectedCell) return;
    
    const [r, c] = selectedCell;

    // 初期配置のセルは変更不可
    if (initialBoard[r][c] !== BLANK) return;

    if (isMemoMode) {
      // メモモード
      const key = `${r}-${c}`;
      const currentMemos = memos[key] || [];
      let newMemos;
      if (currentMemos.includes(num)) {
        newMemos = currentMemos.filter(n => n !== num);
      } else {
        newMemos = [...currentMemos, num].sort();
      }
      setMemos({ ...memos, [key]: newMemos });
    } else {
      // 通常入力モード
      const newBoard = board.map(row => [...row]);
      
      // 同じ数字なら消す（トグル）
      if (newBoard[r][c] === num) {
        newBoard[r][c] = BLANK;
      } else {
        newBoard[r][c] = num;
        
        // 間違い判定（即時フィードバック）
        if (num !== solution[r][c]) {
          setMistakes(prev => prev + 1);
        } else {
          // 正解を入力した場合、そのセルのメモを消す
          const key = `${r}-${c}`;
          if (memos[key]) {
             const { [key]: deleted, ...restMemos } = memos;
             setMemos(restMemos);
          }
        }
      }
      setBoard(newBoard);
      
      // クリア判定
      checkCompletion(newBoard, solution);
    }
  };

  // 消去ボタン
  const handleErase = () => {
    if (isComplete || !selectedCell) return;
    const [r, c] = selectedCell;
    if (initialBoard[r][c] !== BLANK) return;

    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = BLANK;
    setBoard(newBoard);
  };

  // リセットボタン（確認ダイアログ付き）
  const handleReset = () => {
    if (window.confirm('リセットしますか？現在の進度が失われます。')) {
      startNewGame();
    }
  };

  // クリア判定
  const checkCompletion = (currentBoard, solutionBoard) => {
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (currentBoard[i][j] !== solutionBoard[i][j]) return;
      }
    }
    setIsComplete(true);
  };

  // 指定された数字がすべて入力されているかチェック
  const isNumberComplete = (num) => {
    let count = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (board[i][j] === num) count++;
      }
    }
    return count === 9;
  };

  // キーボードイベントのハンドリング
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isComplete) return;
      
      // 数字キー
      if (e.key >= '1' && e.key <= '9') {
        handleNumberInput(parseInt(e.key));
      }
      // バックスペース/Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        handleErase();
      }
      // 矢印キー移動
      if (selectedCell) {
        const [r, c] = selectedCell;
        if (e.key === 'ArrowUp') setSelectedCell([Math.max(0, r - 1), c]);
        if (e.key === 'ArrowDown') setSelectedCell([Math.min(8, r + 1), c]);
        if (e.key === 'ArrowLeft') setSelectedCell([r, Math.max(0, c - 1)]);
        if (e.key === 'ArrowRight') setSelectedCell([r, Math.min(8, c + 1)]);
      }
      // メモモード切替 (Mキー)
      if (e.key === 'm' || e.key === 'M') {
        setIsMemoMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, board, isMemoMode, isComplete, memos]);


  // ---------------------------------------------------------------------------
  // UI レンダリングヘルパー
  // ---------------------------------------------------------------------------

  const getCellStyle = (row, col) => {
    let style = "relative flex items-center justify-center text-lg sm:text-2xl cursor-pointer select-none transition-colors duration-75 ";
    
    // グリッドの境界線
    if (col % 3 === 2 && col !== 8) style += "border-r-2 border-slate-800 ";
    else if (col !== 8) style += "border-r border-slate-300 ";
    
    if (row % 3 === 2 && row !== 8) style += "border-b-2 border-slate-800 ";
    else if (row !== 8) style += "border-b border-slate-300 ";

    const cellValue = board[row][col];
    const isInitial = initialBoard[row][col] !== BLANK;
    const isSelected = selectedCell && selectedCell[0] === row && selectedCell[1] === col;
    const isError = !isInitial && cellValue !== BLANK && cellValue !== solution[row][col];
    const isCorrect = !isInitial && cellValue !== BLANK && cellValue === solution[row][col];
    
    // ハイライトロジック
    const selectedNum = selectedCell && board[selectedCell[0]][selectedCell[1]];
    const isSameNum = (cellValue !== BLANK && cellValue === selectedNum) || 
                      (cellValue === BLANK && selectedNum !== BLANK && memos[`${row}-${col}`]?.includes(selectedNum));

    // 文字色
    if (!isSelected) {
       if (isInitial) style += "font-bold text-slate-900 ";
       else if (isError) style += "text-red-600 font-bold "; // 間違い入力
       else if (isCorrect) style += "text-blue-600 font-bold "; // 正解入力
       else style += "text-slate-900 font-medium "; // ユーザー入力（メモ等）
    }

    if (isSelected) {
      style += "bg-blue-500 text-white ";
    } else if (isSameNum) {
      style += "bg-blue-200 ";
    } else if (isError) {
      style += "bg-white ";
    } else if (isCorrect) {
      style += "bg-white ";
    } else if (selectedCell && (selectedCell[0] === row || selectedCell[1] === col || 
              (Math.floor(selectedCell[0]/3) === Math.floor(row/3) && Math.floor(selectedCell[1]/3) === Math.floor(col/3)))) {
       // 関連する行・列・ボックスのハイライト
       style += "bg-blue-50 ";
    } else {
       style += "bg-white ";
    }

    return style;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans py-6 px-4 flex flex-col items-center">
      
      {/* ヘッダー */}
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">ナンプレ</h1>
        <div className="flex items-center space-x-2 text-sm font-medium text-slate-600">
          <span>ミス: <span className={mistakes > 2 ? "text-red-500" : ""}>{mistakes}</span></span>
          <span>|</span>
          <select 
            value={difficulty} 
            onChange={(e) => {
              setDifficulty(e.target.value);
              startNewGame(e.target.value);
            }}
            className="bg-transparent outline-none cursor-pointer hover:text-blue-600"
          >
            <option value="Easy">初級</option>
            <option value="Medium">中級</option>
            <option value="Hard">上級</option>
          </select>
        </div>
      </div>

      {/* メインボード */}
      <div className="w-full max-w-md bg-slate-900 p-1 rounded-lg shadow-xl mb-6 relative">
        <div className="bg-white grid grid-cols-9 aspect-square border-2 border-slate-900 rounded">
          {board.map((row, rIndex) => (
            <React.Fragment key={rIndex}>
              {row.map((cell, cIndex) => (
                <div 
                  key={`${rIndex}-${cIndex}`}
                  className={getCellStyle(rIndex, cIndex)}
                  onClick={() => setSelectedCell([rIndex, cIndex])}
                >
                  {cell !== BLANK ? (
                    cell
                  ) : (
                    // メモの表示
                    <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 pointer-events-none">
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                        <div key={n} className="flex items-center justify-center text-[8px] sm:text-[10px] leading-none text-slate-500">
                          {memos[`${rIndex}-${cIndex}`]?.includes(n) ? n : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        
        {/* クリア時のオーバーレイ */}
        {isComplete && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-lg animate-in fade-in duration-300">
            <Trophy className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-3xl font-bold text-slate-900 mb-2">クリア！</h2>
            <p className="text-slate-600 mb-6">素晴らしい！全問正解です。</p>
            <button 
              onClick={() => startNewGame()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform transform active:scale-95"
            >
              次のゲームへ
            </button>
          </div>
        )}
      </div>

      {/* コントロールパネル */}
      <div className="w-full max-w-md space-y-4">
        
        {/* アクションボタン */}
        <div className="flex justify-between gap-2">
          <button 
            onClick={() => setIsMemoMode(!isMemoMode)}
            className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg border transition-colors ${isMemoMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <Pencil className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold">メモ {isMemoMode ? 'ON' : 'OFF'}</span>
          </button>
          
          <button 
            onClick={handleErase}
            className="flex-1 flex flex-col items-center justify-center py-3 rounded-lg border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-red-500 transition-colors"
          >
            <Eraser className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold">消去</span>
          </button>

          <button 
            onClick={handleReset}
            className="flex-1 flex flex-col items-center justify-center py-3 rounded-lg border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            <RefreshCw className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold">リセット</span>
          </button>
        </div>

        {/* ナンバーパッド */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberInput(num)}
              disabled={isNumberComplete(num)}
              className={`text-2xl font-bold py-3 sm:py-4 rounded-lg shadow-sm transition-all active:scale-95 ${
                isNumberComplete(num)
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              }`}
            >
              {num}
            </button>
          ))}
           <div className="col-span-1 hidden sm:block"></div>{/* レイアウト調整用 */}
        </div>
      </div>
      
      <div className="mt-8 text-slate-400 text-xs text-center">
         ※ キーボード操作にも対応しています（矢印キー、数字、M、BS/Del）
      </div>

    </div>
  );
}
