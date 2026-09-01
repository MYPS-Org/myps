import React, { useEffect, useState } from 'react';
import { useSpring } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1.2,
  formatter = (val) => Math.round(val).toLocaleString(),
  className = '',
}) => {
  const spring = useSpring(0, {
    stiffness: 70,
    damping: 20,
    duration: duration * 1000,
  });

  const [displayValue, setDisplayValue] = useState<string>(() => formatter(value));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(formatter(latest));
    });
    return () => unsubscribe();
  }, [spring, formatter]);

  return <span className={className}>{displayValue}</span>;
};

export const formatCompactMoney = (value: number) => {
  if (value >= 1e12) {
    return `₱${(value / 1e12).toFixed(2)} T`;
  }
  if (value >= 1e9) {
    return `₱${(value / 1e9).toFixed(2)} B`;
  }
  if (value >= 1e6) {
    return `₱${(value / 1e6).toFixed(2)} M`;
  }
  if (value >= 1e3) {
    return `₱${(value / 1e3).toFixed(1)} K`;
  }
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatFullMoney = (value: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const AnimatedCurrency: React.FC<{
  value: number;
  compact?: boolean;
  className?: string;
}> = ({ value, compact = true, className = '' }) => {
  return (
    <AnimatedNumber
      value={value}
      formatter={compact ? formatCompactMoney : formatFullMoney}
      className={className}
    />
  );
};
