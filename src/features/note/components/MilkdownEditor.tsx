import React, { useEffect, useRef } from "react";
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { nord } from "@milkdown/theme-nord";

export interface MilkdownEditorProps {
  initialContent: string;
  onChange: (markdown: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onScrollHostReady?: (el: HTMLElement | null) => void;
}

const EditorInner: React.FC<MilkdownEditorProps> = ({
  initialContent,
  onChange,
  onFocus,
  onBlur,
  onScrollHostReady,
}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const { loading } = useEditor(
    (root) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialContent);
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            attributes: {
              class: "milkdown-prose window-no-drag",
              spellcheck: "false",
            },
          }));
          nord(ctx);

          const listenerManager = ctx.get(listenerCtx);
          listenerManager.markdownUpdated((_ctx, markdown, prevMarkdown) => {
            if (markdown !== prevMarkdown) {
              onChangeRef.current(markdown);
            }
          });
          listenerManager.focus(() => {
            onFocusRef.current?.();
          });
          listenerManager.blur(() => {
            onBlurRef.current?.();
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(listener);

      return editor;
    },
    []
  );

  useEffect(() => {
    if (!loading && onScrollHostReady) {
      const el = document.querySelector(".sticky-note-surface .ProseMirror") as HTMLElement | null;
      if (el) {
        onScrollHostReady(el);
      }
    }
  }, [loading, onScrollHostReady]);

  return (
    <div className="milkdown-container window-no-drag">
      <Milkdown />
    </div>
  );
};

export const MilkdownEditor: React.FC<MilkdownEditorProps> = (props) => {
  return (
    <MilkdownProvider>
      <EditorInner {...props} />
    </MilkdownProvider>
  );
};

export default MilkdownEditor;
