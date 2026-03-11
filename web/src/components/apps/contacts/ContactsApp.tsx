import { createSignal, For, Show, createEffect, onCleanup, batch, createMemo } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useContacts } from '../../../store/contacts';
import { useMessages } from '../../../store/messages';
import { usePhoneState } from '../../../store/phone';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizePhone } from '../../../utils/sanitize';
import { buildSharedContactMessage } from '../../../utils/contactShare';
import { uiPrompt } from '../../../utils/uiDialog';
import { formatPhoneNumber, generateColorForString, getBestFontColor } from '../../../utils/misc';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { SearchInput } from '../../shared/ui/SearchInput';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import styles from './ContactsApp.module.scss';

export function ContactsApp() {
  const router = useRouter();
  const phoneState = usePhoneState();
  const [contactsState, contactsActions] = useContacts();
  const [, messagesActions] = useMessages();
  const [showForm, setShowForm] = createSignal(false);
  const [editingContact, setEditingContact] = createSignal<number | null>(null);
  const [formName, setFormName] = createSignal('');
  const [formNumber, setFormNumber] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [search, setSearch] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [actionContact, setActionContact] = createSignal<any | null>(null);
  const [shareContact, setShareContact] = createSignal<any | null>(null);
  const [shareChannel, setShareChannel] = createSignal<'messages' | 'wavechat' | null>(null);
  const [tab, setTab] = createSignal<'todos' | 'favoritos'>('todos');
  const [recentCalls, setRecentCalls] = createSignal<string[]>([]);

  const filteredContacts = () => {
    const q = search().trim().toLowerCase();
    if (!q) return contactsState.contacts;
    const base = contactsState.contacts.filter((c) => c.display.toLowerCase().includes(q) || c.number.toLowerCase().includes(q));
    return tab() === 'favoritos' ? base.filter((c) => c.favorite) : base;
  };
  const isReadOnly = createMemo(() => phoneState.accessMode === 'foreign-readonly');

  const contactsCounter = createMemo(() => filteredContacts().length);
  const shareTargets = createMemo(() => {
    const current = shareContact();
    return [...contactsState.contacts]
      .filter((contact) => !current || contact.id !== current.id)
      .sort((a, b) => a.display.localeCompare(b.display, undefined, { sensitivity: 'base' }));
  });

  createEffect(() => {
    const handle = setTimeout(() => setLoading(false), 120);
    onCleanup(() => clearTimeout(handle));
  });

  createEffect(() => {
    const loadRecents = async () => {
      const history = await fetchNui<any[]>('getCallHistory', undefined, []);
      const numbers = Array.from(new Set((history || []).map((c) => String(c.num || '')).filter(Boolean))).slice(0, 4);
      setRecentCalls(numbers);
    };
    void loadRecents();
  });
  
  usePhoneKeyHandler({
    ArrowUp: () => {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    },
    ArrowDown: () => {
      setSelectedIndex((prev) => Math.min(filteredContacts().length, prev + 1));
    },
    Enter: () => {
      const contacts = filteredContacts();
      if (selectedIndex() >= 0 && selectedIndex() < contacts.length) {
        const contact = contacts[selectedIndex()];
        router.navigate('messages.view', { phoneNumber: contact.number, display: contact.display });
      }
    },
    Backspace: () => {
      router.goBack();
    },
  });
  
  const openAddForm = () => {
    if (isReadOnly()) return;
    batch(() => {
      setFormName('');
      setFormNumber('');
      setEditingContact(null);
      setShowForm(true);
    });
  };
  
  const openEditForm = (contact: { id: number; display: string; number: string }) => {
    if (isReadOnly()) return;
    batch(() => {
      setFormName(contact.display);
      setFormNumber(contact.number);
      setEditingContact(contact.id);
      setShowForm(true);
    });
  };
  
  const saveContact = async () => {
    if (isReadOnly()) return;
    if (!formName().trim() || !formNumber().trim()) return;
    
    if (editingContact()) {
      await contactsActions.update(editingContact()!, formName(), formNumber());
    } else {
      await contactsActions.add(formName(), formNumber());
    }
    
    batch(() => {
      setShowForm(false);
      setFormName('');
      setFormNumber('');
      setEditingContact(null);
    });
  };
  
  const deleteContact = async (id: number) => {
    if (isReadOnly()) return;
    await contactsActions.remove(id);
  };
  
  const handleSelect = (contact: { number: string; display: string }) => {
    router.navigate('messages.view', { phoneNumber: contact.number, display: contact.display });
  };

  const openShareContact = () => {
    if (isReadOnly()) return;
    if (!actionContact()) return;
    setShareContact(actionContact());
    setShareChannel(null);
    setActionContact(null);
  };

  const sendSharedContact = async (numberInput: string) => {
    const target = sanitizePhone(numberInput);
    const source = shareContact();
    const channel = shareChannel() || 'messages';
    if (!target || !source) return;
    const payload = buildSharedContactMessage(source.display, source.number);
    if (!payload) return;
    const sent = await messagesActions.send(target, payload);
    if (!sent) return;
    setShareContact(null);
    setShareChannel(null);
    router.navigate(channel, { phoneNumber: target });
  };

  const shareToManualNumber = async () => {
    const input = await uiPrompt('Numero para compartir contacto', { title: 'Compartir contacto' });
    await sendSharedContact(typeof input === 'string' ? input : '');
  };
  
  return (
    <AppScaffold title="Contactos" onBack={() => router.goBack()} action={isReadOnly() ? undefined : { icon: '+', onClick: openAddForm }}>
      <div class={styles.list}>
        <Show when={isReadOnly()}>
          <InlineNotice title="Solo lectura" message={`Estas revisando los contactos de ${phoneState.accessOwnerName || 'otra persona'}.`} />
        </Show>
        <SearchInput
          class={styles.searchWrap}
          value={search()}
          onInput={setSearch}
          placeholder="Buscar contacto"
        />

        <div class={styles.sectionMeta}>
          <span>{tab() === 'favoritos' ? 'Favoritos' : 'Contactos'}</span>
          <strong>{contactsCounter()}</strong>
        </div>

        <div class={styles.segmented}>
          <button class={styles.segmentBtn} classList={{ [styles.active]: tab() === 'todos' }} onClick={() => setTab('todos')}>Todos</button>
          <button class={styles.segmentBtn} classList={{ [styles.active]: tab() === 'favoritos' }} onClick={() => setTab('favoritos')}>Favoritos</button>
        </div>

        <Show when={tab() === 'todos' && recentCalls().length > 0}>
          <div class={styles.quickSection}>
            <div class={styles.quickTitle}>Recientes</div>
            <div class={styles.quickRow}>
              <For each={recentCalls()}>
                {(number) => {
                  const contact = contactsState.contacts.find((c) => c.number === number);
                  const display = contact?.display || number;
                  return (
                    <button class={styles.quickChip} onClick={() => handleSelect({ number, display })}>
                      <span>{display}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        <Show
          when={loading()}
          fallback={
            <ScreenState
              loading={false}
              empty={filteredContacts().length === 0}
              emptyTitle="Sin contactos"
              emptyDescription="Crea un contacto nuevo para comenzar."
            >
              <Show when={!isReadOnly()}>
                <div
                  class={styles.addItem}
                  classList={{ [styles.selected]: selectedIndex() === 0 }}
                  onClick={openAddForm}
                >
                  <div class={styles.avatar} style={{ 'background-color': '#34c759' }}>
                    +
                  </div>
                  <span class={styles.name}>Nuevo contacto</span>
                </div>
              </Show>

              <For each={filteredContacts()}>
                {(contact, index) => (
                  <div
                    class={styles.contactItem}
                    classList={{ [styles.selected]: selectedIndex() === index() + 1 }}
                    onClick={() => handleSelect(contact)}
                  >
                <div 
                  class={styles.avatar}
                  style={{ 
                    'background-color': generateColorForString(contact.number),
                    color: getBestFontColor(generateColorForString(contact.number))
                  }}
                >
                {contact.display.charAt(0).toUpperCase()}
              </div>
              <div class={styles.info}>
                <span class={styles.name}>{contact.display}</span>
                <span class={styles.number}>{formatPhoneNumber(contact.number, phoneState.framework || 'unknown')}</span>
              </div>
              <div class={styles.actions}>
                <Show when={!isReadOnly()}>
                  <button
                    class={styles.actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionContact(contact);
                    }}
                  >
                    •••
                  </button>
                  <button
                    class={styles.actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      void contactsActions.toggleFavorite(contact.id);
                    }}
                  >
                    {contact.favorite ? '★' : '☆'}
                  </button>
                </Show>
              </div>
                  </div>
                )}
              </For>
            </ScreenState>
          }
        >
          <SkeletonList rows={7} avatar />
        </Show>
      </div>

      <Show when={showForm()}>
        <div class={styles.modal}>
          <div class={styles.modalContent}>
            <h2>{editingContact() ? 'Editar contacto' : 'Nuevo contacto'}</h2>
            
            <div class={styles.formGroup}>
              <label>Nombre</label>
              <input
                type="text"
                placeholder="Nombre del contacto"
                value={formName()}
                onInput={(e) => setFormName(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.formGroup}>
              <label>Número</label>
              <input
                type="tel"
                placeholder="555-1234"
                value={formNumber()}
                onInput={(e) => setFormNumber(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.modalActions}>
              <button class={styles.cancelBtn} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button class={styles.saveBtn} onClick={saveContact}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={!!actionContact()}
        title={actionContact() ? actionContact().display : 'Contacto'}
        onClose={() => setActionContact(null)}
        actions={[
          {
            label: 'Enviar mensaje',
            tone: 'primary',
            onClick: () => {
              if (!actionContact()) return;
              handleSelect(actionContact());
            },
          },
          {
            label: 'Editar',
            onClick: () => {
              if (!actionContact()) return;
              openEditForm(actionContact());
            },
          },
          {
            label: 'Compartir contacto',
            onClick: openShareContact,
          },
          {
            label: 'Eliminar',
            tone: 'danger',
            onClick: async () => {
              if (!actionContact()) return;
              await deleteContact(actionContact().id);
            },
          },
        ]}
      />

      <ActionSheet
        open={!!shareContact() && !shareChannel()}
        title="Compartir contacto por"
        onClose={() => {
          setShareContact(null);
          setShareChannel(null);
        }}
        actions={[
          { label: 'Mensajes', tone: 'primary', onClick: () => { setShareChannel('messages'); } },
          { label: 'WaveChat', onClick: () => { setShareChannel('wavechat'); } },
        ]}
      />

      <ActionSheet
        open={!!shareContact() && !!shareChannel()}
        title={shareChannel() === 'wavechat' ? 'Enviar en WaveChat' : 'Enviar en Mensajes'}
        onClose={() => {
          setShareContact(null);
          setShareChannel(null);
        }}
        actions={[
          ...shareTargets().map((contact) => ({
            label: `${contact.display} (${contact.number})`,
            onClick: () => void sendSharedContact(contact.number),
          })),
          { label: 'Ingresar numero', tone: 'primary' as const, onClick: () => void shareToManualNumber() },
        ]}
      />
    </AppScaffold>
  );
}
