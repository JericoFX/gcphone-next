import { For, Show, createSignal } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import { getStoredLanguage, t } from '../../../i18n';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import styles from './NotesApp.module.scss';

interface NoteItem {
  id: number;
  title: string;
  content: string;
  color: string;
}

const NOTE_COLORS = ['#FFF6C7', '#FFE2B8', '#FDE2E4', '#DFF4EA', '#DCEEFF', '#ECE7FF'];

export function NotesApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const { data: notes, loading, setData: setNotes, execute: loadNotes } = useAsyncData(
    () => fetchNui<NoteItem[]>('notesGetAll', {}, []),
    { initialData: [] as NoteItem[] }
  );
  const [active, setActive] = createSignal<NoteItem | null>(null);
  const [isComposerOpen, setIsComposerOpen] = createSignal(false);
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [color, setColor] = createSignal(NOTE_COLORS[0]);
  const ctxMenu = useContextMenu<NoteItem>();

  usePhoneKeyHandler({
    Backspace: () => {
      if (isComposerOpen()) { closeComposer(); return; }
      router.goBack();
    },
  });

  const openComposer = (note?: NoteItem) => {
    if (note) {
      setActive(note);
      setTitle(note.title || '');
      setContent(note.content || '');
      setColor(note.color || NOTE_COLORS[0]);
    } else {
      setActive(null);
      setTitle('');
      setContent('');
      setColor(NOTE_COLORS[0]);
    }
    setIsComposerOpen(true);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    setActive(null);
    setTitle('');
    setContent('');
    setColor(NOTE_COLORS[0]);
  };

  const save = async () => {
    const nextTitle = title().trim();
    const nextContent = content().trim();
    if (!nextTitle && !nextContent) return;

    const payload: Record<string, unknown> = {
      title: nextTitle,
      content: nextContent,
      color: color(),
    };
    if (active()) payload.id = active()!.id;

    const result = await fetchNui<{ success?: boolean; id?: number }>('notesSave', payload, { success: false });
    if (result?.success) {
      closeComposer();
      await loadNotes();
    }
  };

  const remove = async (id: number) => {
    await fetchNui<{ success?: boolean }>('notesDelete', { id }, { success: false });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (active()?.id === id) closeComposer();
  };

  const shareNoteByMail = (note: Pick<NoteItem, 'title' | 'content'>) => {
    router.navigate('mail', { compose: '1', subject: note.title || t('notes.shared_note', language()) || 'Nota compartida', body: note.content || '' });
  };

  const notePreview = (note: Pick<NoteItem, 'content'>) => {
    const text = (note.content || '').trim();
    if (!text) return t('notes.empty_note', language()) || 'Nota vacia';
    return text.length > 110 ? `${text.slice(0, 110)}...` : text;
  };

  const noteMeta = (note: Pick<NoteItem, 'title' | 'content'>) => {
    const words = Math.max(1, `${note.title} ${note.content}`.trim().split(/\s+/).filter(Boolean).length);
    const lines = Math.max(1, (note.content || '').split('\n').filter((l) => l.trim().length > 0).length);
    return `${words} ${t('notes.words', language()) || 'palabras'} · ${lines} ${t('notes.lines', language()) || 'lineas'}`;
  };

  return (
    <AppScaffold
      title={t('notes.title', language()) || 'Notas'}
      onBack={() => (isComposerOpen() ? closeComposer() : router.goBack())}
      action={{ icon: '+', onClick: () => openComposer() }}
    >
      <ScreenState loading={loading()} empty={!isComposerOpen() && notes().length === 0} emptyTitle={t('notes.empty_title', language()) || 'Sin notas'} emptyDescription={t('notes.empty_desc', language()) || 'Crea tu primera nota con el boton +.'}>
        <Show when={!isComposerOpen()} fallback={(
          <section class={styles.editorShell}>
            <div class={`ios-card ${styles.editorCard}`}>
              <div class={styles.editorHeader}>
                <div>
                  <span class={styles.eyebrow}>{active() ? (t('notes.editing', language()) || 'EDITANDO') : (t('notes.new_note', language()) || 'NUEVA NOTA')}</span>
                  <h3>{active() ? (t('notes.adjust', language()) || 'Ajusta tu nota') : (t('notes.write_quick', language()) || 'Escribe algo rapido')}</h3>
                </div>
                <button class={`ios-btn ${styles.mailButton}`} onClick={() => shareNoteByMail({ title: title(), content: content() })}>
                  Mail
                </button>
              </div>

              <input class="ios-input" type="text" placeholder={t('notes.title_placeholder', language()) || 'Titulo'} value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
              <textarea class={`ios-textarea ${styles.editorTextarea}`} placeholder={t('notes.content_placeholder', language()) || 'Escribe una nota...'} value={content()} onInput={(e) => setContent(e.currentTarget.value)} />

              <div class={styles.colorBlock}>
                <div>
                  <span class={styles.eyebrow}>{t('notes.color', language()) || 'COLOR'}</span>
                </div>
                <div class={styles.palette}>
                  <For each={NOTE_COLORS}>
                    {(swatch) => (
                      <button type="button" class={styles.swatch} classList={{ [styles.swatchSelected]: color() === swatch }} style={{ background: swatch }} onClick={() => setColor(swatch)} />
                    )}
                  </For>
                </div>
              </div>

              <div class={styles.editorActions}>
                <button class="ios-btn" onClick={closeComposer}>{t('action.cancel', language()) || 'Cancelar'}</button>
                <button class="ios-btn ios-btn-primary" onClick={() => void save()}>{t('notes.save', language()) || 'Guardar'}</button>
              </div>
            </div>
          </section>
        )}>
          <div class={styles.listShell}>
            <div class={styles.list}>
              <For each={notes()}>
                {(note) => (
                  <article class={styles.card} style={{ '--note-color': note.color }} onContextMenu={ctxMenu.onContextMenu(note)}>
                    <div class={styles.cardAccent} />
                    <div class={styles.cardBody}>
                      <div class={styles.cardHeader}>
                        <strong>{note.title || t('notes.untitled', language()) || 'Sin titulo'}</strong>
                        <span>{noteMeta(note)}</span>
                      </div>
                      <p>{notePreview(note)}</p>
                      <div class={styles.actions}>
                        <button class="ios-btn" onClick={() => shareNoteByMail(note)}>Mail</button>
                        <button class="ios-btn" onClick={() => openComposer(note)}>{t('action.edit', language()) || 'Editar'}</button>
                        <button class="ios-btn ios-btn-danger" onClick={() => void remove(note.id)}>{t('action.delete', language()) || 'Eliminar'}</button>
                      </div>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </div>
        </Show>
      </ScreenState>

      <ActionSheet
        open={ctxMenu.isOpen()}
        title={ctxMenu.item()?.title || t('notes.title', language())}
        onClose={ctxMenu.close}
        actions={[
          {
            label: t('notes.edit', language()) || 'Editar',
            onClick: () => {
              const note = ctxMenu.item();
              if (note) openComposer(note);
              ctxMenu.close();
            },
          },
          {
            label: 'Mail',
            onClick: () => {
              const note = ctxMenu.item();
              if (note) shareNoteByMail(note);
              ctxMenu.close();
            },
          },
          {
            label: t('action.delete', language()),
            tone: 'danger',
            onClick: () => {
              const note = ctxMenu.item();
              if (note) void remove(note.id);
              ctxMenu.close();
            },
          },
        ]}
      />
    </AppScaffold>
  );
}
