import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { Lock } from 'lucide-react';
import { Button } from './ui/button';

interface PinModalProps {
  onSuccess: (pin: string) => void;
  onCancel: () => void;
  actionLabel?: string;
}

export default function PinModal({ onSuccess, onCancel, actionLabel }: PinModalProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus the first input on load
    inputs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    // Advance to next box if filled
    if (value && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const enteredPin = pin.join('');
    if (enteredPin.length < 4) {
      setError('Please enter all 4 digits');
      return;
    }
    setLoading(true);
    try {
      const isValid = await api.verifyPin(enteredPin);
      if (isValid) {
        // Save to sessionStorage for future requests
        sessionStorage.setItem('access_pin', enteredPin);
        onSuccess(enteredPin);
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin(['', '', '', '']);
        inputs.current[0]?.focus();
      }
    } catch (e: any) {
      setError(e.message || 'Error verifying PIN');
      setPin(['', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        
        {/* Glowy Lock Icon */}
        <div className="h-16 w-16 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner animate-pulse">
          <Lock className="h-8 w-8" />
        </div>

        <h3 className="text-xl font-bold tracking-tight mb-2">
          Security Access Control
        </h3>
        
        <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
          Enter your 4-digit security PIN to {actionLabel || 'continue to protected settings'}.
        </p>

        {/* PIN Grid */}
        <div className="flex gap-3 justify-center mb-6">
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onKeyPress={handleKeyPress}
              className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border bg-muted outline-none transition-all duration-150 ${
                digit 
                  ? 'border-primary ring-2 ring-primary/20 bg-background' 
                  : error 
                    ? 'border-destructive ring-2 ring-destructive/10 bg-destructive/5' 
                    : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        <div className="h-5 mb-4 text-xs font-semibold text-destructive">
          {error && <span>{error}</span>}
        </div>

        {/* Actions */}
        <div className="w-full space-y-2">
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="w-full font-semibold h-11"
          >
            {loading ? 'Verifying PIN...' : 'Grant Authentication'}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={onCancel}
            className="w-full text-muted-foreground hover:text-foreground h-11"
          >
            Cancel and Return
          </Button>
        </div>
      </div>
    </div>
  );
}
