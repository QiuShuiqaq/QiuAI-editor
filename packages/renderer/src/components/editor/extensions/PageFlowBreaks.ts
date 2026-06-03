import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export interface PageFlowBreakSpec {
  pos: number;
  height: number;
  kind?: 'block' | 'line';
}

export const pageFlowBreaksKey = new PluginKey<DecorationSet>('qiu-page-flow-breaks');

function buildDecorations(doc: ProseMirrorNode, breaks: PageFlowBreakSpec[]) {
  const decorations = breaks
    .filter((item) => Number.isFinite(item.pos) && item.pos >= 0 && Number.isFinite(item.height) && item.height > 0)
    .map((item, index) =>
      Decoration.widget(
        item.pos,
        () => {
          const spacer = document.createElement('span');
          spacer.className = `qiu-page-flow-spacer qiu-page-flow-spacer-${item.kind ?? 'block'}`;
          spacer.style.height = `${item.height}px`;
          spacer.style.display = 'block';
          spacer.style.width = '100%';
          spacer.style.pointerEvents = 'none';
          spacer.style.userSelect = 'none';
          spacer.setAttribute('data-page-flow-break', `${index}`);
          spacer.setAttribute('data-page-flow-pos', `${item.pos}`);
          spacer.setAttribute('data-page-flow-height', `${item.height}`);
          spacer.setAttribute('data-page-flow-kind', item.kind ?? 'block');
          return spacer;
        },
        {
          side: -1,
          ignoreSelection: true,
        }
      )
    );

  return DecorationSet.create(doc, decorations);
}

export const PageFlowBreaks = Extension.create({
  name: 'pageFlowBreaks',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageFlowBreaksKey,
        state: {
          init: (_config, state) => buildDecorations(state.doc, []),
          apply(tr, oldState) {
            const meta = tr.getMeta(pageFlowBreaksKey) as PageFlowBreakSpec[] | undefined;
            if (meta) {
              return buildDecorations(tr.doc, meta);
            }

            if (tr.docChanged) {
              return oldState.map(tr.mapping, tr.doc);
            }

            return oldState;
          },
        },
        props: {
          decorations(state) {
            return pageFlowBreaksKey.getState(state) ?? null;
          },
        },
        }),
    ];
  },
});

export function setPageFlowBreaks(editor: Editor, breaks: PageFlowBreakSpec[]) {
  editor.view.dispatch(editor.view.state.tr.setMeta(pageFlowBreaksKey, breaks));
}
