'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Text } from './Typography';
import CustomTimeInput from './CustomTimeInput';

interface TimePickerProps {
  value: string; // Expected format: "HH:mm" in 24-hour format
  onChange: (time: string) => void;
  className?: string;
  id?: string;
}

export default function TimePicker({ value, onChange, className = '', id }: TimePickerProps) {
  // Convert 24-hour time to 12-hour format for display
  const convertTo12Hour = (time24: string) => {
    const [hours24, minutes] = time24.split(':').map(Number);
    const period = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    return { hours: hours12, minutes, period };
  };

  // Convert 12-hour format back to 24-hour for storage
  const convertTo24Hour = (hours12: number, minutes: number, period: 'AM' | 'PM') => {
    let hours24 = hours12;
    if (period === 'PM' && hours12 !== 12) {
      hours24 = hours12 + 12;
    } else if (period === 'AM' && hours12 === 12) {
      hours24 = 0;
    }
    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const { hours: initialHours, minutes: initialMinutes, period: initialPeriod } = convertTo12Hour(value);

  const [hours, setHours] = useState(initialHours.toString());
  const [minutes, setMinutes] = useState(initialMinutes.toString().padStart(2, '0'));
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialPeriod as 'AM' | 'PM');


  // Update internal state when value prop changes
  useEffect(() => {
    const { hours: newHours, minutes: newMinutes, period: newPeriod } = convertTo12Hour(value);
    setHours(newHours.toString());
    setMinutes(newMinutes.toString().padStart(2, '0'));
    setPeriod(newPeriod as 'AM' | 'PM');
  }, [value]);

  // Update parent when any time component changes
  useEffect(() => {
    const hoursNum = parseInt(hours) || 12;
    const minutesNum = parseInt(minutes) || 0;

    // Only update if we have valid values and the minutes field is complete or empty
    if (hoursNum >= 1 && hoursNum <= 12 && minutesNum >= 0 && minutesNum <= 59 && (minutes === '' || minutes.length >= 1)) {
      const time24 = convertTo24Hour(hoursNum, minutesNum, period);
      if (time24 !== value) {
        onChange(time24);
      }
    }
  }, [hours, minutes, period]);

  const togglePeriod = () => {
    setPeriod(period === 'AM' ? 'PM' : 'AM');
  };

  return (
    <div className={`inline-flex items-center px-3 py-2 border border-gray-200 rounded-lg bg-white gradient-border-focus-within ${className}`}>
      <CustomTimeInput
        value={hours}
        onChange={(value) => setHours(value)}
        variant="hours"
        placeholder="12"
      />

      <Text variant="small" as="span" className="select-none -mx-1">:</Text>

      <CustomTimeInput
        value={minutes}
        onChange={(value) => setMinutes(value)}
        variant="minutes"
        placeholder="00"
      />

      <button
        type="button"
        onClick={togglePeriod}
        className="ml-2 px-2 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100 rounded transition-colors select-none focus:outline-none focus:ring-0 focus:border-transparent"
      >
        {period}
      </button>
    </div>
  );
}