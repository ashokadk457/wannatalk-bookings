import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');
}
export default function PolicyRichEditor({
  initialValue,
  format,
  readOnly = false,
  disabled = false,
  onChange,
}: {
  initialValue: string;
  format: string;
  readOnly?: boolean;
  disabled?: boolean;
  onChange?: (html: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false),
    [url, setUrl] = useState(''),
    [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: readOnly,
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
        },
      }),
    ],
    content: format === 'html' ? initialValue : textToHtml(initialValue),
    editable: !readOnly && !disabled,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'policy-editor-document',
        ...(readOnly
          ? {}
          : {
              role: 'textbox',
              'aria-label': 'Your cancellation policy',
              'aria-multiline': 'true',
            }),
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.isEmpty ? '' : editor.getHTML()),
    onCreate: ({ editor }) => onChange?.(editor.isEmpty ? '' : editor.getHTML()),
  });
  useEffect(() => {
    editor?.setEditable(!readOnly && !disabled);
  }, [editor, readOnly, disabled]);
  if (!editor) return null;
  const button = (label: string, action: () => void, active = false, unavailable = false) => (
    <button
      type="button"
      className={`policy-tool${active ? ' active' : ''}`}
      aria-pressed={active}
      disabled={disabled || unavailable}
      onClick={action}
    >
      {label}
    </button>
  );
  return (
    <div className={readOnly ? 'policy-reader' : 'policy-rich-editor'}>
      {!readOnly && (
        <>
          <div className="policy-editor-toolbar" role="group" aria-label="Text formatting">
            <select
              aria-label="Paragraph style"
              className="policy-style-select"
              disabled={disabled}
              value={
                editor.isActive('heading', { level: 2 })
                  ? 'h2'
                  : editor.isActive('heading', { level: 3 })
                    ? 'h3'
                    : 'p'
              }
              onChange={(e) => {
                if (e.target.value === 'p') editor.chain().focus().setParagraph().run();
                else
                  editor
                    .chain()
                    .focus()
                    .setHeading({ level: e.target.value === 'h2' ? 2 : 3 })
                    .run();
              }}
            >
              <option value="p">Normal text</option>
              <option value="h2">Heading</option>
              <option value="h3">Subheading</option>
            </select>
            {button(
              'Bold',
              () => {
                editor.chain().focus().toggleBold().run();
              },
              editor.isActive('bold'),
            )}
            {button(
              'Italic',
              () => {
                editor.chain().focus().toggleItalic().run();
              },
              editor.isActive('italic'),
            )}
            {button(
              'Underline',
              () => {
                editor.chain().focus().toggleUnderline().run();
              },
              editor.isActive('underline'),
            )}
            {button(
              'Bullet list',
              () => {
                editor.chain().focus().toggleBulletList().run();
              },
              editor.isActive('bulletList'),
            )}
            {button(
              'Numbered list',
              () => {
                editor.chain().focus().toggleOrderedList().run();
              },
              editor.isActive('orderedList'),
            )}
            {button(
              'Quote',
              () => {
                editor.chain().focus().toggleBlockquote().run();
              },
              editor.isActive('blockquote'),
            )}
            {button(
              'Link',
              () => {
                setUrl(editor.getAttributes('link').href || '');
                setLinkError('');
                setLinkOpen(!linkOpen);
              },
              editor.isActive('link'),
            )}
            {button(
              'Undo',
              () => {
                editor.chain().focus().undo().run();
              },
              false,
              !editor.can().undo(),
            )}
            {button(
              'Redo',
              () => {
                editor.chain().focus().redo().run();
              },
              false,
              !editor.can().redo(),
            )}
            {button('Clear format', () => {
              editor.chain().focus().clearNodes().unsetAllMarks().run();
            })}
          </div>
          {linkOpen && (
            <div className="policy-link-editor">
              <label>
                Link address
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={disabled}
                />
              </label>
              <button
                type="button"
                className="btn secondary small"
                disabled={disabled}
                onClick={() => {
                  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) {
                    setLinkError('Use an https://, http://, mailto: or tel: address.');
                    return;
                  }
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange('link')
                    .setLink({ href: url.trim() })
                    .run();
                  setLinkOpen(false);
                }}
              >
                Apply link
              </button>
              <button
                type="button"
                className="btn secondary small"
                disabled={disabled}
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                Remove link
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setLinkOpen(false)}
              >
                Close
              </button>
              {linkError && <span role="alert">{linkError}</span>}
            </div>
          )}
        </>
      )}
      <EditorContent editor={editor} />
      {!readOnly && (
        <div className="policy-editor-footer">
          Format your cancellation terms as patients will see them.
          <span>{editor.getText().length.toLocaleString()} characters</span>
        </div>
      )}
    </div>
  );
}
