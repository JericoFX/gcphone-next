import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import styles from './NotesApp.module.scss';

interface NoteItem {
  id: number;
  title: string;
  content: string;
  color: string;
}

const NOTE_COLORS = [
  '#FFF6C7',
  '#FFE2B8',
  '#FDE2E4',
  '#DFF4EA',
  '#DCEEFF',
  '#ECE7FF',
];

export function NotesApp() {
  const router = useRouter();
  const [notes, setNotes] = createSignal<NoteItem[]>([
    { id: 1, title: 'Compras', content: 'Agua, pan, cafe', color: '#FFF6C7' },
    { id: 2, title: 'Recordatorio', content: 'Pasar por mecanico', color: '#DCEEFF' },
  ]);
  const [active, setActive] = createSignal<NoteItem | null>(null);
  const [isComposerOpen, setIsComposerOpen] = createSignal(false);
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [color, setColor] = createSignal(NOTE_COLORS[0]);
  const [loading, setLoading] = createSignal(true);

  usePhoneKeyHandler({
    Backspace: () => {
      if (isComposerOpen()) {
        closeComposer();
        return;
      }
      router.goBack();
    },
  });

  createEffect(() => {
    const handle = setTimeout(() => setLoading(false), 120);
    onCleanup(() => clearTimeout(handle));
  });

  const openComposer = (note?: NoteItem) => {
    if (note) {
      setActive(note);
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color);
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

  const save = () => {
    const nextTitle = title().trim();
    const nextContent = content().trim();
    if (!nextTitle && !nextContent) return;

    if (active()) {
      setNotes((prev) =>
        prev.map((note) => (
          note.id === active()!.id
            ? { ...note, title: nextTitle, content: nextContent, color: color() }
            : note
        ))
      );
      closeComposer();
      return;
    }

    setNotes((prev) => [{ id: Date.now(), title: nextTitle, content: nextContent, color: color() }, ...prev]);
    closeComposer();
  };

  const remove = (id: number) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (active()?.id === id) closeComposer();
  };

  const shareNoteByMail = (note: Pick<NoteItem, 'title' | 'content'>) => {
    router.navigate('mail', {
      compose: '1',
      subject: note.title || 'Nota compartida',
      body: note.content || '',
    });
  };

  const notePreview = (note: Pick<NoteItem, 'content'>) => {
    const text = (note.content || '').trim();
    if (!text) return 'Nota vacia';
    return text.length > 110 ? `${text.slice(0, 110)}...` : text;
  };

  const noteMeta = (note: Pick<NoteItem, 'title' | 'content'>) => {
    const wordCount = `${Math.max(1, `${note.title} ${note.content}`.trim().split(/\s+/).filter(Boolean).length)} palabras`;
    const lineCount = `${Math.max(1, (note.content || '').split('\n').filter((line) => line.trim().length > 0).length)} lineas`;
    return `${wordCount} · ${lineCount}`;
  };

  return (
    <AppScaffold
      title="Notas"
      onBack={() => (isComposerOpen() ? closeComposer() : router.goBack())}
      action={{ icon: '+', onClick: () => openComposer() }}
    >
      <ScreenState loading={loading()} empty={!isComposerOpen() && notes().length === 0} emptyTitle="Sin notas" emptyDescription="Crea tu primera nota con el boton +.">
        <Show when={!isComposerOpen()} fallback={(
          <section class={styles.editorShell}>
            <div class={`ios-card ${styles.editorCard}`}>
              <div class={styles.editorHeader}>
                <div>
                  <span class={styles.eyebrow}>{active() ? 'EDITANDO' : 'NUEVA NOTA'}</span>
                  <h3>{active() ? 'Ajusta tu nota' : 'Escribe algo rapido'}</h3>
                </div>
                <button class={`ios-btn ${styles.mailButton}`} onClick={() => shareNoteByMail({ title: title(), content: content() })}>
                  Mail
                </button>
              </div>

              <input class="ios-input" type="text" placeholder="Titulo" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
              <textarea class={`ios-textarea ${styles.editorTextarea}`} placeholder="Escribe una nota..." value={content()} onInput={(e) => setContent(e.currentTarget.value)} />

              <div class={styles.colorBlock}>
                <div>
                  <span class={styles.eyebrow}>COLOR</span>
                  <p>Elige un tono suave para organizar tus notas.</p>
                </div>
                <div class={styles.palette}>
                  <For each={NOTE_COLORS}>
                    {(swatch) => (
                      <button
                        type="button"
                        class={styles.swatch}
                        classList={{ [styles.swatchSelected]: color() === swatch }}
                        style={{ background: swatch }}
                        onClick={() => setColor(swatch)}
                        aria-label={`Seleccionar color ${swatch}`}
                      />
                    )}
                  </For>
                </div>
              </div>

              <div class={styles.editorActions}>
                <button class="ios-btn" onClick={closeComposer}>Cancelar</button>
                <button class="ios-btn ios-btn-primary" onClick={save}>Guardar</button>
              </div>
            </div>
          </section>
        )}>
          <div class={styles.listShell}>
            <div class={`ios-card ${styles.overviewCard}`}>
              <div>
                <span class={styles.eyebrow}>TU ESPACIO</span>
                <h3>{notes().length} notas disponibles</h3>
              </div>
              <p>Tarjetas limpias, colores suaves y acciones rapidas sin romper el estilo del telefono.</p>
            </div>

            <div class={styles.list}>
              <For each={notes()}>
                {(note) => (
                  <article class={styles.card} style={{ '--note-color': note.color }}>
                    <div class={styles.cardAccent} />
                    <div class={styles.cardBody}>
                      <div class={styles.cardHeader}>
                        <div>
                          <strong>{note.title || 'Sin titulo'}</strong>
                          <span>{noteMeta(note)}</span>
                        </div>
                        <div class={styles.noteBadge}>Nota</div>
                      </div>
                      <p>{notePreview(note)}</p>
                      <div class={styles.actions}>
                        <button class="ios-btn" onClick={() => shareNoteByMail(note)}>Mail</button>
                        <button class="ios-btn" onClick={() => openComposer(note)}>Editar</button>
                        <button class="ios-btn ios-btn-danger" onClick={() => remove(note.id)}>Eliminar</button>
                      </div>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </div>
        </Show>
      </ScreenState>
    </AppScaffold>
  );
}
