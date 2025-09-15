'use client';

import React, { useRef, useState, useEffect } from 'react';

interface CustomTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  variant: 'hours' | 'minutes';
  placeholder?: string;
  className?: string;
}

export default function CustomTimeInput({ value, onChange, variant, placeholder, className = '' }: CustomTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [originalValue, setOriginalValue] = useState(value);

  // Update original value when prop changes
  useEffect(() => {
    setOriginalValue(value);
    if (!isFocused) {
      setInputValue('');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setOriginalValue(value); // Store the current value
    setInputValue(''); // Clear the input
  };

  const handleBlur = () => {
    setIsFocused(false);

    // If no input was provided, restore original value
    if (inputValue === '') {
      setInputValue('');
      // Don't change the original value
      return;
    }

    // Process the input and update
    let finalValue = inputValue;
    if (finalValue.length === 1) {
      finalValue = '0' + finalValue;
    }

    onChange(finalValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Only allow digits
    const digitsOnly = newValue.replace(/\D/g, '');

    // Apply variant-specific validation
    let validatedValue = '';

    if (digitsOnly.length === 0) {
      validatedValue = '';
    } else if (digitsOnly.length === 1) {
      validatedValue = digitsOnly;
    } else {
      // Two or more digits
      const firstDigit = digitsOnly[0];
      const secondDigit = digitsOnly[1];

      if (variant === 'hours') {
        // Hours: special rules for second digit
        if (firstDigit === '0') {
          // First digit 0: allow any second digit
          validatedValue = firstDigit + secondDigit;
        } else if (firstDigit === '1') {
          // First digit 1: only allow 0, 1, 2 as second digit
          if (['0', '1', '2'].includes(secondDigit)) {
            validatedValue = firstDigit + secondDigit;
          } else {
            validatedValue = firstDigit;
          }
        } else {
          // First digit 2-9: no second digit allowed
          validatedValue = firstDigit;
        }
      } else {
        // Minutes: second digit only allowed if first is 0-5
        if (['0', '1', '2', '3', '4', '5'].includes(firstDigit)) {
          validatedValue = firstDigit + secondDigit;
        } else {
          validatedValue = firstDigit;
        }
      }
    }

    setInputValue(validatedValue);
  };

  const displayValue = isFocused ? inputValue : originalValue;
  const showPlaceholder = isFocused && inputValue === '';

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={showPlaceholder ? '00' : ''}
      maxLength={2}
      className={`
        w-8 text-center text-sm bg-transparent outline-none cursor-pointer
        ${showPlaceholder ? 'text-gray-400' : 'text-gray-900'}
        ${className}
      `}
    />
  );
}