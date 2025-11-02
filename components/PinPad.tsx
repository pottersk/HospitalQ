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
      <div className="mb-8 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`
              w-4 h-4 rounded-full
              ${pin.length > i 
                ? 'bg-pink-500 scale-110' 
                : 'bg-pink-100 border-2 border-pink-200'
              }
              transition-all duration-200
            `}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-pink-600 text-center mb-6 animate-shake">
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
              aspect-square rounded-full text-2xl sm:text-3xl font-semibold
              flex items-center justify-center
              ${digit === 'delete' || digit === 'clear'
                ? 'text-pink-600 hover:bg-pink-50'
                : 'bg-white hover:bg-pink-50 text-pink-800'
              }
              border-2 border-pink-100
              transition-all duration-200
              hover:scale-105 hover:shadow-lg
              active:scale-95
            `}
          >
            {digit === 'delete' ? (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2H10.828a2 2 0 01-1.414-.586L3 12z" />
              </svg>
            ) : digit === 'clear' ? (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              digit
            )}
          </button>
        ))}
      </div>
    </div>
  );
}