"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

export type RichTextEditorProps = {
  /** Initial document. Remount with `key` when loading a different entry. */
  defaultContent?: JSONContent | null;
  onChange?: (content: JSONContent) => void;
  /** Plain text from the editor when the user presses Enter (Shift+Enter inserts a newline). */
  onSubmitEnter?: (plainText: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  editable?: boolean;
};

export function RichTextEditor({
  defaultContent,
  onChange,
  onSubmitEnter,
  placeholder = "Start writing…",
  className,
  editorClassName,
  editable = true,
}: RichTextEditorProps) {
  const onSubmitEnterRef = useRef(onSubmitEnter);

  useEffect(() => {
    onSubmitEnterRef.current = onSubmitEnter;
  }, [onSubmitEnter]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: defaultContent ?? undefined,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: ["tiptap-editor", editorClassName].filter(Boolean).join(" "),
      },
      handleKeyDown: (_view, event) => {
        if (event.key !== "Enter" || event.shiftKey) return false;
        if (!onSubmitEnterRef.current) return false;

        event.preventDefault();
        const text = _view.state.doc.textContent.trim();
        if (text) onSubmitEnterRef.current(text);
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
