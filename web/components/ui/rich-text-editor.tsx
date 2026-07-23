"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

export type RichTextEditorProps = {
  /** Initial document. Remount with `key` when loading a different entry. */
  defaultContent?: JSONContent | null;
  onChange?: (content: JSONContent) => void;
  onTextChange?: (plainText: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  editable?: boolean;
};

export function RichTextEditor({
  defaultContent,
  onChange,
  onTextChange,
  placeholder = "Start writing…",
  className,
  editorClassName,
  editable = true,
}: RichTextEditorProps) {
  const onTextChangeRef = useRef(onTextChange);

  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

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
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getJSON());
      onTextChangeRef.current?.(currentEditor.getText());
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
