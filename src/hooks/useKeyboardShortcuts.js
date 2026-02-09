import { useEffect } from 'react';

const parseCombo = combo => {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  return {
    key,
    ctrl: parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
};

const isEditableElement = target => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const useKeyboardShortcuts = (shortcuts = [], enabled = true) => {
  useEffect(() => {
    if (!enabled || !Array.isArray(shortcuts) || shortcuts.length === 0) return;

    const onKeyDown = event => {
      for (const shortcut of shortcuts) {
        const parsed = parseCombo(shortcut.combo);
        const keyMatch = event.key.toLowerCase() === parsed.key;
        const modifiersMatch =
          (!!(event.ctrlKey || event.metaKey) === parsed.ctrl) &&
          (!!event.shiftKey === parsed.shift) &&
          (!!event.altKey === parsed.alt);

        if (!keyMatch || !modifiersMatch) continue;

        if (shortcut.allowInInput !== true && isEditableElement(event.target)) {
          continue;
        }

        event.preventDefault();
        shortcut.handler?.();
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts, enabled]);
};
