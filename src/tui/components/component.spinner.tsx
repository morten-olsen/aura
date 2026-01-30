import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

import { theme } from '../theme/theme.ts';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type SpinnerProps = {
  label?: string;
  color?: string;
};

const Spinner = ({ label, color = theme.colors.primary }: SpinnerProps): React.ReactElement => {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);

    return (): void => {
      clearInterval(timer);
    };
  }, []);

  const frame = SPINNER_FRAMES[frameIndex];

  return (
    <Text>
      <Text color={color}>{frame}</Text>
      {label && <Text color={theme.colors.text}> {label}</Text>}
    </Text>
  );
};

export type { SpinnerProps };
export { Spinner };
