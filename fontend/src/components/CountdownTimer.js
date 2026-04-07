'use client';
import { useState, useEffect } from 'react';
import { formatTimeLeft, getTimeUrgency } from '@/lib/utils';
import { Clock } from 'lucide-react';

export default function CountdownTimer({ endTime, onEnd }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgency, setUrgency] = useState('normal');

  useEffect(() => {
    const update = () => {
      const left = formatTimeLeft(endTime);
      setTimeLeft(left);
      setUrgency(getTimeUrgency(endTime));

      if (left === 'Ended' && onEnd) {
        onEnd();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime, onEnd]);

  const colorClass = urgency === 'urgent' ? 'text-ebay-red countdown-urgent' :
                     urgency === 'soon' ? 'text-orange-600' :
                     urgency === 'ended' ? 'text-gray-500' : 'text-ebay-dark';

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`}>
      <Clock className="w-3.5 h-3.5" />
      <span className="font-medium">{timeLeft}</span>
    </span>
  );
}
