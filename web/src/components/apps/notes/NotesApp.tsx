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

export function NotesApp() {
  const router = useRouter();
  const [notes, setNotes] = createSignal<NoteItem[]>([
    { id: 1, title: 'Compras', content: 'Agua, pan, cafe', color: '#fff9d8' },
    { id: 2, title: 'Recordatorio', content: 'Pasar por mecanico', color: '#e8f4ff' },
  ]);
  const [active, setActive] = createSignal<NoteItem | null>(null);
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [color, setColor] = createSignal('#fff9d8');
  const [loading, setLoading] = createSignal(true);

  usePhoneKeyHandler({
    Backspace: () => {
      if (active()) {
        setActive(null);
        return;
      }
      router.goBack();
    },
  });

  createEffect(() => {
    const handle = setTimeout(() => setLoading(false), 120);
    onCleanup(() => clearTimeout(handle));
  });

  const startCreate = () => {
    setActive(null);
    setTitle('');
    setContent('');
    setColor('#fff9d8');
  };

  const edit = (note: NoteItem) => {
    setActive(note);
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color);
  };

  const save = () => {
    if (!title().trim() && !content().trim()) return;

    if (active()) {
      setNotes((prev) =>
        prev.map((n) => (n.id === active()!.id ? { ...n, title: title(), content: content(), color: color() } : n))
      );
      setActive(null);
      return;
    }

    setNotes((prev) => [{ id: Date.now(), title: title(), content: content(), color: color() }, ...prev]);
    setTitle('');
    setContent('');
  };

  const remove = (id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (active()?.id === id) setActive(null);
  };

  return (
    <AppScaffold
      title="Notas"
      onBack={() => (active() ? setActive(null) : router.goBack())}
      action={{ icon: '+', onClick: startCreate }}
    >
      <ScreenState loading={loading()} empty={!active() && notes().length === 0} emptyTitle="Sin notas" emptyDescription="Crea tu primera nota con el boton +.">
        <Show when={!active()} fallback={
          <div class={`ios-card ${styles.editor}`}>
            <input class="ios-input" type="text" placeholder="Titulo" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
            <textarea class="ios-textarea" placeholder="Escribe una nota..." value={content()} onInput={(e) => setContent(e.currentTarget.value)} />
            <input class="ios-input" type="color" value={color()} onInput={(e) => setColor(e.currentTarget.value)} />
            <div class={styles.editorActions}>
              <button class="ios-btn" onClick={() => setActive(null)}>Cancelar</button>
              <button class="ios-btn ios-btn-primary" onClick={save}>Guardar</button>
            </div>
          </div>
        }>
          <div class={styles.list}>
            <For each={notes()}>
              {(note) => (
                <article class={styles.card} style={{ 'background-color': note.color }}>
                  <strong>{note.title || 'Sin titulo'}</strong>
                  <p>{note.content || 'Nota vacia'}</p>
                  <div class={styles.actions}>
                    <button class="ios-btn" onClick={() => edit(note)}>Editar</button>
                    <button class="ios-btn ios-btn-danger" onClick={() => remove(note.id)}>Eliminar</button>
                  </div>
                </article>
              )}
            </For>
          </div>
        </Show>
      </ScreenState>
    </AppScaffold>
  );
}
