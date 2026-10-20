import { useLayoutEffect, useRef } from 'react';

export default function InlineStickerText({ value, editing, code, onDraft, onSave, onCancel, onCopy, onDragStart }: {
  value: string; editing: boolean; code: boolean; onDraft: (value: string) => void;
  onSave: () => void; onCancel: () => void; onCopy: () => void; onDragStart: React.DragEventHandler<HTMLDivElement>;
}) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    node.textContent = value;
    if (editing) {
      node.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(node); range.collapse(false);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    }
  }, [value, editing]);
  return <div ref={element} className={`sticker-inline-text window-no-drag${code ? ' sticker-code-content' : ''}`}
    contentEditable={editing ? 'plaintext-only' : false} suppressContentEditableWarning
    role={editing ? 'textbox' : undefined} aria-label={editing ? '编辑贴图文本' : undefined} aria-multiline={editing || undefined}
    draggable={!editing} onDragStart={onDragStart} onDoubleClick={editing ? undefined : onCopy}
    onInput={event => onDraft(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
    onKeyDown={event => {
      if (!editing || event.nativeEvent.isComposing) return;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); onSave(); }
      else if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    }} />;
}
