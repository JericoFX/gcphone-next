import { createSignal, For, Show, createEffect, onCleanup, onMount, batch, createMemo } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useContacts } from '../../../store/contacts';
import { useMessages } from '../../../store/messages';
import { usePhoneState } from '../../../store/phone';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizePhone } from '../../../utils/sanitize';
import { buildSharedContactMessage } from '../../../utils/contactShare';
import { uiPrompt } from '../../../utils/uiDialog';
import { formatPhoneNumber, generateColorForString } from '../../../utils/misc';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNfcShare } from '../../../hooks/useNfcShare';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { AppScaffold } from '../../shared/layout';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { NfcShareSheet } from '../../shared/ui/NfcShareSheet';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { SearchInput } from '../../shared/ui/SearchInput';
import { ScreenState } from '../../shared/ui/ScreenState';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { t } from '../../../i18n';
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
  const ctxMenu = useContextMenu<any>();
  const [shareContact, setShareContact] = createSignal<any | null>(null);
  const [shareChannel, setShareChannel] = createSignal<'messages' | 'wavechat' | null>(null);
  const [tab, setTab] = createSignal<'todos' | 'favoritos'>('todos');
  const [recentCalls, setRecentCalls] = createSignal<string[]>([]);
  const language = () => phoneState.settings.language || 'es';

  const filteredContacts = createMemo(() => {
    const q = search().trim().toLowerCase();
    const contacts = tab() === 'favoritos'
      ? contactsState.contacts.filter((contact) => contact.favorite)
      : contactsState.contacts;

    if (!q) return contacts;

    return contacts.filter((c) => c.display.toLowerCase().includes(q) || c.number.toLowerCase().includes(q));
  });

  const contactsByNumber = createMemo(() => {
    const map = new Map<string, { display: string; number: string }>();

    for (const contact of contactsState.contacts) {
      map.set(contact.number, contact);
    }

    return map;
  });
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

  onMount(() => {
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

  const nfcShare = useNfcShare({
    onShare: async (targetServerId) => {
      const contact = shareContact();
      if (!contact) return { success: false, error: 'INVALID_DATA' };
      return fetchNui('shareContact', {
        targetServerId,
        contact: { display: contact.display, number: contact.number, avatar: contact.avatar },
      }, { success: false });
    },
    successMessage: 'Contacto compartido por NFC',
  });

  const openShareContact = () => {
    if (isReadOnly()) return;
    if (!ctxMenu.item()) return;
    setShareContact(ctxMenu.item());
    setShareChannel(null);
    ctxMenu.close();
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
    const input = await uiPrompt(t('contacts.share_number_prompt', language()), { title: t('contacts.share_contact', language()) });
    await sendSharedContact(typeof input === 'string' ? input : '');
  };
  
  return (
    <AppScaffold title={t('contacts.title', language())} onBack={() => router.goBack()} action={isReadOnly() ? undefined : { icon: '+', onClick: openAddForm }}>
      <div class={styles.list}>
        <Show when={isReadOnly()}>
          <InlineNotice title={t('contacts.readonly_title', language())} message={t('contacts.readonly_message', language(), { name: phoneState.accessOwnerName || t('common.other_person', language()) })} />
        </Show>
        <SearchInput
          class={styles.searchWrap}
          value={search()}
          onInput={setSearch}
          placeholder={t('contacts.search', language())}
        />

        <div class={styles.sectionMeta}>
          <span>{tab() === 'favoritos' ? t('contacts.favorites', language()) : t('contacts.title', language())}</span>
          <strong>{contactsCounter()}</strong>
        </div>

        <div class={styles.segmented}>
          <button class={styles.segmentBtn} classList={{ [styles.active]: tab() === 'todos' }} onClick={() => setTab('todos')}>{t('contacts.all', language())}</button>
          <button class={styles.segmentBtn} classList={{ [styles.active]: tab() === 'favoritos' }} onClick={() => setTab('favoritos')}>{t('contacts.favorites', language())}</button>
        </div>

        <Show when={tab() === 'todos' && recentCalls().length > 0}>
          <div class={styles.quickSection}>
            <div class={styles.quickTitle}>{t('calls.tab.recents', language())}</div>
            <div class={styles.quickRow}>
              <For each={recentCalls()}>
                {(number) => {
                   const contact = contactsByNumber().get(number);
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
              emptyTitle={t('contacts.empty_title', language())}
              emptyDescription={t('contacts.empty_desc', language())}
            >
              <Show when={!isReadOnly()}>
                <div
                  class={styles.addItem}
                  classList={{ [styles.selected]: selectedIndex() === 0 }}
                  onClick={openAddForm}
                >
                  <div class={styles.avatar} classList={{ [styles.addAvatar]: true }}>
                    +
                  </div>
                  <span class={styles.name}>{t('contacts.new', language())}</span>
                </div>
              </Show>

              <For each={filteredContacts()}>
                {(contact, index) => (
                  <div
                    class={styles.contactItem}
                    classList={{ [styles.selected]: selectedIndex() === index() + 1 }}
                    onClick={() => handleSelect(contact)}
                    onContextMenu={ctxMenu.onContextMenu(contact)}
                  >
                <LetterAvatar class={styles.avatar} color={generateColorForString(contact.number)} label={contact.display} />
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
                      ctxMenu.open(contact);
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
            <h2>{editingContact() ? t('contacts.edit_contact', language()) : t('contacts.new', language())}</h2>
            
            <div class={styles.formGroup}>
              <label>{t('contacts.field.name', language())}</label>
              <input
                type="text"
                placeholder={t('contacts.name_placeholder', language())}
                value={formName()}
                onInput={(e) => setFormName(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.formGroup}>
              <label>{t('contacts.field.number', language())}</label>
              <input
                type="tel"
                placeholder="555-1234"
                value={formNumber()}
                onInput={(e) => setFormNumber(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.modalActions}>
              <button class={styles.cancelBtn} onClick={() => setShowForm(false)}>
                {t('action.cancel', language())}
              </button>
              <button class={styles.saveBtn} onClick={saveContact}>
                {t('notes.save', language())}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={ctxMenu.isOpen()}
        title={ctxMenu.item() ? ctxMenu.item().display : 'Contacto'}
        onClose={ctxMenu.close}
        actions={[
          {
            label: t('contacts.send_message', language()),
            tone: 'primary',
            onClick: () => {
              if (!ctxMenu.item()) return;
              handleSelect(ctxMenu.item());
            },
          },
          {
            label: t('notes.edit', language()),
            onClick: () => {
              if (!ctxMenu.item()) return;
              openEditForm(ctxMenu.item());
            },
          },
          {
            label: t('contacts.share_contact', language()),
            onClick: openShareContact,
          },
          {
            label: t('action.delete', language()),
            tone: 'danger',
            onClick: async () => {
              if (!ctxMenu.item()) return;
              await deleteContact(ctxMenu.item().id);
            },
          },
        ]}
      />

      <ActionSheet
        open={!!shareContact() && !shareChannel()}
        title={t('contacts.share_via', language())}
        onClose={() => {
          setShareContact(null);
          setShareChannel(null);
        }}
        actions={[
          { label: 'Compartir NFC', tone: 'primary', onClick: () => nfcShare.open() },
          { label: t('messages.title', language()), onClick: () => { setShareChannel('messages'); } },
          { label: 'WaveChat', onClick: () => { setShareChannel('wavechat'); } },
        ]}
      />

      <ActionSheet
        open={!!shareContact() && !!shareChannel()}
        title={shareChannel() === 'wavechat' ? t('contacts.send_in_wavechat', language()) : t('contacts.send_in_messages', language())}
        onClose={() => {
          setShareContact(null);
          setShareChannel(null);
        }}
        actions={[
          ...shareTargets().map((contact) => ({
            label: `${contact.display} (${contact.number})`,
            onClick: () => void sendSharedContact(contact.number),
          })),
          { label: t('contacts.enter_number', language()), tone: 'primary' as const, onClick: () => void shareToManualNumber() },
        ]}
      />

      <NfcShareSheet
        open={nfcShare.isOpen()}
        onClose={nfcShare.close}
        onSelect={(id) => void nfcShare.handleSelect(id)}
        title="Compartir contacto"
        maxDistance={3.0}
        disabled={nfcShare.sharing()}
      />
    </AppScaffold>
  );
}
