import { useCallback } from 'react';
import { useInput, useApp } from 'ink';

type ShortcutHandler = () => void;

type ShortcutMap = Record<string, ShortcutHandler>;

type UseShortcutsOptions = {
  isActive?: boolean;
};

const useShortcuts = (shortcuts: ShortcutMap, options: UseShortcutsOptions = {}): void => {
  const { isActive = true } = options;

  useInput((input, key) => {
    if (!isActive) return;

    // Handle special keys
    if (key.escape && shortcuts['escape']) {
      shortcuts['escape']();
      return;
    }
    if (key.return && shortcuts['return']) {
      shortcuts['return']();
      return;
    }
    if (key.upArrow && shortcuts['up']) {
      shortcuts['up']();
      return;
    }
    if (key.downArrow && shortcuts['down']) {
      shortcuts['down']();
      return;
    }
    if (key.leftArrow && shortcuts['left']) {
      shortcuts['left']();
      return;
    }
    if (key.rightArrow && shortcuts['right']) {
      shortcuts['right']();
      return;
    }
    if (key.tab && shortcuts['tab']) {
      shortcuts['tab']();
      return;
    }
    if (key.backspace && shortcuts['backspace']) {
      shortcuts['backspace']();
      return;
    }
    if (key.delete && shortcuts['delete']) {
      shortcuts['delete']();
      return;
    }

    // Handle character shortcuts
    const handler = shortcuts[input];
    if (handler) {
      handler();
    }
  });
};

const useQuitShortcut = (): void => {
  const { exit } = useApp();

  useInput((input) => {
    if (input === 'q') {
      exit();
    }
  });
};

type UseListNavigationOptions = {
  itemCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (index: number) => void;
  isActive?: boolean;
  wrap?: boolean;
};

const useListNavigation = ({
  itemCount,
  selectedIndex,
  onSelect,
  onActivate,
  isActive = true,
  wrap = false,
}: UseListNavigationOptions): void => {
  const moveUp = useCallback(() => {
    if (itemCount === 0) return;
    if (selectedIndex > 0) {
      onSelect(selectedIndex - 1);
    } else if (wrap) {
      onSelect(itemCount - 1);
    }
  }, [itemCount, selectedIndex, onSelect, wrap]);

  const moveDown = useCallback(() => {
    if (itemCount === 0) return;
    if (selectedIndex < itemCount - 1) {
      onSelect(selectedIndex + 1);
    } else if (wrap) {
      onSelect(0);
    }
  }, [itemCount, selectedIndex, onSelect, wrap]);

  const activate = useCallback(() => {
    if (onActivate && itemCount > 0) {
      onActivate(selectedIndex);
    }
  }, [onActivate, itemCount, selectedIndex]);

  const shortcuts: ShortcutMap = {
    up: moveUp,
    down: moveDown,
    k: moveUp,
    j: moveDown,
  };

  if (onActivate) {
    shortcuts['return'] = activate;
  }

  useShortcuts(shortcuts, { isActive });
};

export type { ShortcutHandler, ShortcutMap, UseShortcutsOptions, UseListNavigationOptions };
export { useShortcuts, useQuitShortcut, useListNavigation };
