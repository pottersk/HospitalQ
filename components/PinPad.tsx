import { useState, useCallback } from 'react';

type PinPadProps = {
  onSuccess: () => void;
  correctPin?: string;
};

export function PinPad({ onSuccess, correctPin = '0000' }: PinPadProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState(false);
  
  const handlePress = useCallback((digit: number | 'clear' | 'delete') => {
    if (error) setError(false);
    
    if (digit === 'clear') {
      setPin('');
      return;
    }
    
    if (digit === 'delete') {
      setPin(prev => prev.slice(0, -1));
      return;
    }
    
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === 4) {
        if (newPin === correctPin) {
          onSuccess();
        } else {
          setError(true);
          setPin('');
        }
      }
    }
  }, [pin, error, correctPin, onSuccess]);

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear' as const, 0, 'delete' as const];

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* PIN Display */}
      <div className="mb-10 flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`
              w-5 h-5 rounded-full
              ${pin.length > i 
                ? 'bg-gradient-to-r from-pink-500 to-pink-600 scale-110' 
                : 'bg-pink-50 border-2 border-pink-200'
              }
              transition-all duration-300
            `}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-pink-600 text-center mb-8 animate-shake font-bold flex items-center justify-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          รหัสไม่ถูกต้อง กรุณาลองใหม่
        </div>
      )}

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-4 sm:gap-6">
        {digits.map((digit, i) => (
          <button
            key={i}
            onClick={() => handlePress(digit)}
            className={`
              aspect-square rounded-[1.5rem] text-2xl sm:text-3xl font-extrabold
              flex items-center justify-center
              ${digit === 'delete' || digit === 'clear'
                ? 'text-pink-600 bg-pink-50 hover:bg-pink-100 border-2 border-pink-200/60'
                : 'bg-gradient-to-br from-white to-pink-50/30 hover:from-pink-50 hover:to-pink-100/50 text-pink-800 border-2 border-pink-100/80'
              }
              transition-all duration-300
              hover:scale-105
              active:scale-95
              relative overflow-hidden group
            `}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-pink-100/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            {digit === 'delete' ? (
              <svg className="w-7 h-7 sm:w-8 sm:h-8 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2H10.828a2 2 0 01-1.414-.586L3 12z" />
              </svg>
            ) : digit === 'clear' ? (
              <svg className="w-7 h-7 sm:w-8 sm:h-8 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <span className="relative z-10">{digit}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}