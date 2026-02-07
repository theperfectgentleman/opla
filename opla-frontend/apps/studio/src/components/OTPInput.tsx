import React, { useRef, useState, KeyboardEvent, ClipboardEvent } from 'react';

interface OTPInputProps {
    length?: number;
    onComplete: (otp: string) => void;
    onChangeValue?: (otp: string) => void;
}

const OTPInput: React.FC<OTPInputProps> = ({
    length = 6,
    onComplete,
    onChangeValue
}) => {
    const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (index: number, value: string) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Call onChange callback
        const otpString = newOtp.join('');
        if (onChangeValue) {
            onChangeValue(otpString);
        }

        // Auto-advance to next input
        if (value && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Check if OTP is complete
        if (newOtp.filter(Boolean).length === length) {
            onComplete(otpString);
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        // Move to previous input on backspace if current is empty
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }

        // Move to next input on right arrow
        if (e.key === 'ArrowRight' && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Move to previous input on left arrow
        if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text/plain').trim();

        // Only process if pasted data is all digits and correct length
        if (/^\d+$/.test(pastedData) && pastedData.length === length) {
            const newOtp = pastedData.split('');
            setOtp(newOtp);

            // Focus last input
            inputRefs.current[length - 1]?.focus();

            // Trigger completion
            onComplete(pastedData);
            if (onChangeValue) {
                onChangeValue(pastedData);
            }
        }
    };

    const handleFocus = (index: number) => {
        inputRefs.current[index]?.select();
    };

    return (
        <div className="flex gap-3 justify-center">
            {otp.map((digit, index) => (
                <input
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    onFocus={() => handleFocus(index)}
                    className="
            w-12 h-14 
            text-center text-2xl font-semibold
            bg-[hsl(var(--input-bg))]
            border-2 border-[hsl(var(--input-border))]
            rounded-xl
            text-[hsl(var(--text-primary))]
            focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]
            focus:border-transparent
            transition-all duration-200
            hover:border-[hsl(var(--border-hover))]
          "
                    style={{
                        caretColor: 'hsl(var(--primary))',
                    }}
                />
            ))}
        </div>
    );
};

export default OTPInput;
