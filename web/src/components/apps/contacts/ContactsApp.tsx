import { createSignal, For, Show, createEffect, onCleanup, onMount, batch, createMemo } from 'solid-js';
import { Motion } from '@motionone/solid';
import { useRouter } from '../../Phone/PhoneRouterContext';
import { useContacts } from '../../../store/contacts';
import { useMessages } from '../../../store/messages';
import { usePhoneState } from '../../../store/phone';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizePhone, sanitizeMediaUrl } from '../../../utils/sanitize';
import { buildSharedContactMessage } from '../../../utils/contactShare';
import { uiPrompt } from '../../../utils/uiDialog';
import { formatPhoneNumber, generateColorForString } from '../../../utils/misc';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNfcShare } from '../../../hooks/useNfcShare';
import { AppScaffold } from '../../shared/layout';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { NfcShareSheet } from '../../shared/ui/NfcShareSheet';
import { SearchInput } from '../../shared/ui/SearchInput';
import { ScreenState } from '../../shared/ui/ScreenState';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { t } from '../../../i18n';
import type { ContactRequest } from '../../../types';
import styles from './ContactsApp.module.scss';

interface Contact {
  id: number;
  number: string;
  display: string;
  avatar?: string;
  favorite?: boolean;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

export function ContactsApp() {
  const router = useRouter();
  const phoneState = usePhoneState();
  const [contactsState, contactsActions] = useContacts();
  const [, messagesActions] = useMessages();

  /* ── List state ── */
  const [search, setSearch] = createSignal('');
  const [tab, setTab] = createSignal<'all' | 'favorites'>('all');
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [loading, setLoading] = createSignal(true);
  const [recentCalls, setRecentCalls] = createSignal<string[]>([]);

  /* ── Profile state ── */
  const [profileContact, setProfileContact] = createSignal<Contact | null>(null);

  /* ── Edit modal state ── */
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [editingContact, setEditingContact] = createSignal<Contact | null>(null);
  const [formName, setFormName] = createSignal('');
  const [formNumber, setFormNumber] = createSignal('');
  const [formAvatar, setFormAvatar] = createSignal('');

  /* ── Avatar picker sheet ── */
  const [showAvatarSheet, setShowAvatarSheet] = createSignal(false);

  /* ── Share state ── */
  const [shareContact, setShareContact] = createSignal<Contact | null>(null);
  const [shareChannel, setShareChannel] = createSignal<'messages' | 'wavechat' | null>(null);
  const [receivedContactRequest, setReceivedContactRequest] = createSignal<ContactRequest | null>(null);
  const [lastNfcRouteKey, setLastNfcRouteKey] = createSignal('');

  const language = () => phoneState.settings.language || 'es';
  const isReadOnly = createMemo(() => phoneState.accessMode === 'foreign-readonly');

  const sectionRefs = new Map<string, HTMLElement>();

  /* ── Derived data ── */

  const filteredContacts = createMemo(() => {
    const q = search().trim().toLowerCase();
    const contacts = tab() === 'favorites'
      ? contactsState.contacts.filter((c: Contact) => c.favorite)
      : contactsState.contacts;
    if (!q) return contacts as Contact[];
    return (contacts as Contact[]).filter(
      (c) => c.display.toLowerCase().includes(q) || c.number.toLowerCase().includes(q),
    );
  });

  const groupedContacts = createMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const contact of filteredContacts()) {
      const firstChar = contact.display.trim().charAt(0).toUpperCase();
      const key = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(contact);
    }
    return new Map(
      [...map.entries()].sort((a, b) => {
        if (a[0] === '#') return 1;
        if (b[0] === '#') return -1;
        return a[0].localeCompare(b[0]);
      }),
    );
  });

  const contactsByNumber = createMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contactsState.contacts as Contact[]) {
      map.set(contact.number, contact);
    }
    return map;
  });

  const shareTargets = createMemo(() => {
    const current = shareContact();
    return [...(contactsState.contacts as Contact[])]
      .filter((c) => !current || c.id !== current.id)
      .sort((a, b) => a.display.localeCompare(b.display, undefined, { sensitivity: 'base' }));
  });

  /* ── Effects ── */

  createEffect(() => {
    if (!contactsState.loading) {
      setLoading(false);
    }
  });

  onMount(() => {
    const loadRecents = async () => {
      const history = await fetchNui<{ num: string }[]>('getCallHistory', undefined, []);
      const numbers = Array.from(
        new Set((history || []).map((c) => String(c.num || '')).filter(Boolean)),
      ).slice(0, 5);
      setRecentCalls(numbers);
    };
    void loadRecents();
  });

  // Camera return handler for avatar
  createEffect(() => {
    const media = router.params().avatarMedia;
    if (typeof media === 'string' && media) {
      setFormAvatar(sanitizeMediaUrl(media) || '');
      setShowEditModal(true);
    }
  });

  createEffect(() => {
    const params = router.params() as {
      nfcAction?: string;
      requestId?: number;
      contactRequest?: ContactRequest;
    };
    const key = `${params?.requestId || 0}:${params?.nfcAction || 'none'}`;
    if (params?.nfcAction !== 'received_contact' || !params.contactRequest || key === lastNfcRouteKey()) return;
    setLastNfcRouteKey(key);
    setReceivedContactRequest(params.contactRequest);
    setProfileContact(null);
  });

  /* ── Keyboard navigation ── */

  usePhoneKeyHandler({
    ArrowUp: () => setSelectedIndex((prev) => Math.max(0, prev - 1)),
    ArrowDown: () => setSelectedIndex((prev) => Math.min(filteredContacts().length, prev + 1)),
    Enter: () => {
      const contacts = filteredContacts();
      if (selectedIndex() >= 0 && selectedIndex() < contacts.length) {
        openProfile(contacts[selectedIndex()]);
      }
    },
    Backspace: () => {
      if (nfcShare.isOpen()) {
        nfcShare.close();
        return;
      }
      if (showAvatarSheet()) {
        setShowAvatarSheet(false);
        return;
      }
      if (shareContact()) {
        setShareContact(null);
        setShareChannel(null);
        return;
      }
      if (showEditModal()) {
        setShowEditModal(false);
        return;
      }
      if (receivedContactRequest()) {
        setReceivedContactRequest(null);
        return;
      }
      if (profileContact()) {
        setProfileContact(null);
        return;
      }
      router.goBack();
    },
  }, { routeId: 'contacts' });

  /* ── NFC Share ── */

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

  /* ── Actions ── */

  const openProfile = (contact: Contact) => {
    setProfileContact(contact);
  };

  const closeProfile = () => {
    setProfileContact(null);
  };

  const openAddForm = () => {
    if (isReadOnly()) return;
    batch(() => {
      setFormName('');
      setFormNumber('');
      setFormAvatar('');
      setEditingContact(null);
      setShowEditModal(true);
    });
  };

  const openEditForm = (contact: Contact) => {
    if (isReadOnly()) return;
    batch(() => {
      setFormName(contact.display);
      setFormNumber(contact.number);
      setFormAvatar(contact.avatar || '');
      setEditingContact(contact);
      setShowEditModal(true);
    });
  };

  const saveContact = async () => {
    if (isReadOnly()) return;
    if (!formName().trim() || !formNumber().trim()) return;

    const editing = editingContact();
    const avatarVal = formAvatar().trim() || undefined;

    if (editing) {
      await contactsActions.update(editing.id, formName(), formNumber(), avatarVal);
    } else {
      await contactsActions.add(formName(), formNumber(), avatarVal);
    }

    batch(() => {
      setShowEditModal(false);
      setFormName('');
      setFormNumber('');
      setFormAvatar('');
      setEditingContact(null);
      // If we were editing from profile, refresh profile contact
      if (editing) {
        const updated = (contactsState.contacts as Contact[]).find((c) => c.id === editing.id);
        if (updated) setProfileContact(updated);
        else setProfileContact(null);
      }
    });
  };

  const deleteContact = async (id: number) => {
    if (isReadOnly()) return;
    await contactsActions.remove(id);
    setProfileContact(null);
  };

  const callContact = (number: string) => {
    void fetchNui('callNumber', { number });
  };

  const messageContact = (contact: Contact) => {
    router.navigate('messages.view', { phoneNumber: contact.number, display: contact.display });
  };

  const wavechatContact = (contact: Contact) => {
    router.navigate('wavechat', { phoneNumber: contact.number, display: contact.display });
  };

  const openShareFlow = (contact: Contact) => {
    if (isReadOnly()) return;
    setShareContact(contact);
    setShareChannel(null);
  };

  const sendSharedContact = async (numberInput: string) => {
    const target = sanitizePhone(numberInput);
    const source = shareContact();
    const channel = shareChannel() || 'messages';
    if (!target || !source) return;
    const payload = buildSharedContactMessage(source.display, source.number);
    if (!payload) return;
    const sent = await messagesActions.send({ phoneNumber: target, message: payload });
    if (!sent) return;
    setShareContact(null);
    setShareChannel(null);
    router.navigate(channel, { phoneNumber: target });
  };

  const shareToManualNumber = async () => {
    const input = await uiPrompt(t('contacts.share_number_prompt', language()), { title: t('contacts.share_contact', language()) });
    await sendSharedContact(typeof input === 'string' ? input : '');
  };

  const acceptReceivedContact = async () => {
    const request = receivedContactRequest();
    if (!request) return;

    const result = await fetchNui<{ success?: boolean }>('acceptContactRequest', {
      fromServerId: request.fromServerId,
      display: request.contact.display,
      number: request.contact.number,
      avatar: request.contact.avatar,
    }, { success: false });

    if (result?.success) {
      setReceivedContactRequest(null);
      await contactsActions.fetch();
    }
  };

  /* ── Avatar picker actions ── */

  const pickFromCamera = () => {
    setShowAvatarSheet(false);
    router.navigate('camera', { target: 'contact-avatar' });
  };

  const pickFromGallery = async () => {
    setShowAvatarSheet(false);
    const gallery = await fetchNui<{ url: string }[]>('getGallery', undefined, []);
    const first = (gallery || []).find((item) => item?.url);
    if (first?.url) setFormAvatar(first.url);
  };

  const pickFromUrl = async () => {
    setShowAvatarSheet(false);
    const input = await uiPrompt('URL', { title: t('contacts.avatar.url', language()) });
    if (typeof input === 'string' && input.trim()) {
      const clean = sanitizeMediaUrl(input.trim());
      if (clean) setFormAvatar(clean);
    }
  };

  const removeAvatar = () => {
    setShowAvatarSheet(false);
    setFormAvatar('');
  };

  /* ── Lateral quick scroll ── */

  const scrollToLetter = (letter: string) => {
    const el = sectionRefs.get(letter);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleIndexPointer = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    const letter = target.dataset?.letter;
    if (letter) scrollToLetter(letter);
  };

  /* ── Render ── */

  return (
    <AppScaffold
      title={t('contacts.title', language())}
      onBack={() => router.goBack()}
      action={isReadOnly() ? undefined : { icon: '+', onClick: openAddForm }}
    >
      {/* ── List View ── */}
      <div class={styles.list}>
        <div class={styles.searchWrap}>
          <SearchInput
            value={search()}
            onInput={setSearch}
            placeholder={t('contacts.search', language())}
          />
        </div>

        <Show when={receivedContactRequest()}>
          {(request) => (
            <Motion.div
              class={styles.nfcReceivedCard}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, easing: [0.32, 0.72, 0, 1] }}
            >
              <LetterAvatar
                label={request().contact.display}
                color={generateColorForString(request().contact.number)}
                imageUrl={request().contact.avatar || undefined}
                gradient={!request().contact.avatar}
                size={44}
              />
              <div class={styles.nfcReceivedInfo}>
                <span class={styles.nfcReceivedEyebrow}>NFC</span>
                <strong>{request().contact.display}</strong>
                <span>{request().fromPlayer || 'Alguien'} quiere compartir este contacto</span>
                <small>{formatPhoneNumber(request().contact.number, phoneState.framework || 'unknown')}</small>
              </div>
              <div class={styles.nfcReceivedActions}>
                <button class={styles.primary} onClick={() => void acceptReceivedContact()}>Guardar</button>
                <button class={styles.ghost} onClick={() => setReceivedContactRequest(null)}>Descartar</button>
              </div>
            </Motion.div>
          )}
        </Show>

        {/* Segmented tabs */}
        <div class={styles.segmented}>
          <button
            class={styles.segmentBtn}
            classList={{ [styles.active]: tab() === 'all' }}
            onClick={() => setTab('all')}
          >
            {t('contacts.all', language())}
          </button>
          <button
            class={styles.segmentBtn}
            classList={{ [styles.active]: tab() === 'favorites' }}
            onClick={() => setTab('favorites')}
          >
            {t('contacts.favorites', language())}
          </button>
        </div>

        {/* Recents row */}
        <Show when={tab() === 'all' && recentCalls().length > 0}>
          <div class={styles.recentsSection}>
            <div class={styles.recentsLabel}>{t('contacts.recents', language())}</div>
            <div class={styles.recentsRow}>
              <For each={recentCalls()}>
                {(number) => {
                  const contact = () => contactsByNumber().get(number);
                  const display = () => contact()?.display || number;
                  return (
                    <button
                      class={styles.recentItem}
                      onClick={() => openProfile({ id: contact()?.id || 0, number, display: display(), avatar: contact()?.avatar, favorite: contact()?.favorite })}
                    >
                      <LetterAvatar
                        label={display()}
                        color={generateColorForString(number)}
                        imageUrl={contact()?.avatar || undefined}
                        gradient={!contact()?.avatar}
                        size={40}
                      />
                      <span class={styles.recentName}>{display()}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Main contacts list */}
        <Show
          when={!loading()}
          fallback={<SkeletonList rows={7} avatar />}
        >
          <ScreenState
            loading={false}
            empty={filteredContacts().length === 0}
            emptyTitle={t('contacts.empty_title', language())}
            emptyDescription={t('contacts.empty_desc', language())}
          >
            <div class={styles.scrollArea}>
              <div class={styles.contactsList}>
                {/* Add contact row */}
                <Show when={!isReadOnly()}>
                  <div
                    class={styles.addItem}
                    classList={{ [styles.selected]: selectedIndex() === 0 }}
                    onClick={openAddForm}
                  >
                    <div class={styles.addAvatar}>+</div>
                    <span class={styles.addLabel}>{t('contacts.new', language())}</span>
                  </div>
                </Show>

                {/* Grouped contacts */}
                <For each={[...groupedContacts().entries()]}>
                  {([letter, contacts]) => (
                    <>
                      <div
                        class={styles.sectionHeader}
                        ref={(el) => sectionRefs.set(letter, el)}
                      >
                        {letter}
                      </div>
                      <For each={contacts}>
                        {(contact, index) => (
                          <Motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.22, delay: Math.min(index(), 12) * 0.03 }}
                          >
                            <div
                              class={styles.contactItem}
                              onClick={() => openProfile(contact)}
                            >
                              <LetterAvatar
                                label={contact.display}
                                color={generateColorForString(contact.number)}
                                imageUrl={contact.avatar || undefined}
                                gradient={!contact.avatar}
                                size={40}
                              />
                              <div class={styles.contactInfo}>
                                <span class={styles.contactName}>{contact.display}</span>
                                <span class={styles.contactNumber}>
                                  {formatPhoneNumber(contact.number, phoneState.framework || 'unknown')}
                                </span>
                              </div>
                              <Show when={contact.favorite}>
                                <span class={styles.favoriteIcon}>★</span>
                              </Show>
                            </div>
                            <Show when={index() < contacts.length - 1}>
                              <div class={styles.separator} />
                            </Show>
                          </Motion.div>
                        )}
                      </For>
                    </>
                  )}
                </For>
              </div>

              {/* Lateral quick-scroll index */}
              <div
                class={styles.lateralIndex}
                onPointerDown={handleIndexPointer}
                onPointerMove={(e) => {
                  if (e.buttons > 0) handleIndexPointer(e);
                }}
              >
                <For each={ALPHABET}>
                  {(letter) => (
                    <div class={styles.letterIndex} data-letter={letter}>
                      {letter}
                    </div>
                  )}
                </For>
              </div>
            </div>
          </ScreenState>
        </Show>
      </div>

      {/* ═══ Profile View ═══ */}
      <Show when={profileContact()}>
        {(contact) => (
          <div class={styles.profileOverlay}>
            <div class={styles.profileHeader}>
              <button class={styles.profileBack} onClick={closeProfile}>
                ‹ {t('contacts.title', language())}
              </button>
            </div>

            <div class={styles.profileHero}>
              <LetterAvatar
                label={contact().display}
                color={generateColorForString(contact().number)}
                imageUrl={contact().avatar || undefined}
                gradient={!contact().avatar}
                size={96}
              />
              <div class={styles.profileName}>{contact().display}</div>
              <div class={styles.profileNumber}>
                {formatPhoneNumber(contact().number, phoneState.framework || 'unknown')}
              </div>
            </div>

            {/* Action row */}
            <div class={styles.actionRow}>
              <button class={styles.actionItem} onClick={() => callContact(contact().number)}>
                <div class={styles.actionCircle}>📞</div>
                <span class={styles.actionLabel}>{t('contacts.profile.call', language())}</span>
              </button>
              <button class={styles.actionItem} onClick={() => messageContact(contact())}>
                <div class={styles.actionCircle}>💬</div>
                <span class={styles.actionLabel}>{t('contacts.profile.message', language())}</span>
              </button>
              <button class={styles.actionItem} onClick={() => wavechatContact(contact())}>
                <div class={styles.actionCircle}>🌊</div>
                <span class={styles.actionLabel}>{t('contacts.profile.wavechat', language())}</span>
              </button>
              <Show when={!isReadOnly()}>
                <button class={styles.actionItem} onClick={() => openShareFlow(contact())}>
                  <div class={styles.actionCircle}>↗</div>
                  <span class={styles.actionLabel}>{t('contacts.profile.share', language())}</span>
                </button>
              </Show>
            </div>

            {/* Details card */}
            <div class={styles.detailsCard}>
              <div class={styles.detailRow}>
                <span class={styles.detailLabel}>{t('contacts.field.number', language())}</span>
                <span class={styles.detailValue}>
                  {formatPhoneNumber(contact().number, phoneState.framework || 'unknown')}
                </span>
              </div>
              <div class={styles.detailRowSep} />
              <div class={styles.detailRow}>
                <span class={styles.detailLabel}>
                  {contact().favorite
                    ? t('contacts.profile.favorite_on', language())
                    : t('contacts.profile.favorite_off', language())}
                </span>
                <Show when={!isReadOnly()}>
                  <button
                    class={styles.detailToggle}
                    onClick={() => void contactsActions.toggleFavorite(contact().id)}
                  >
                    {contact().favorite ? '★' : '☆'}
                  </button>
                </Show>
              </div>
              <Show when={!isReadOnly()}>
                <div class={styles.detailRowSep} />
                <div class={styles.detailRow}>
                  <button class={styles.detailEdit} onClick={() => openEditForm(contact())}>
                    {t('contacts.profile.edit', language())}
                  </button>
                </div>
                <div class={styles.detailRowSep} />
                <div class={styles.detailRow}>
                  <button class={styles.detailDanger} onClick={() => void deleteContact(contact().id)}>
                    {t('contacts.profile.delete', language())}
                  </button>
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>

      {/* ═══ Edit Modal ═══ */}
      <Show when={showEditModal()}>
        <div class={styles.modal} onClick={() => setShowEditModal(false)}>
          <div class={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div class={styles.modalHeader}>
              <button class={styles.modalCancel} onClick={() => setShowEditModal(false)}>
                {t('action.cancel', language())}
              </button>
              <span class={styles.modalTitle}>
                {editingContact() ? t('contacts.edit_contact', language()) : t('contacts.new', language())}
              </span>
              <button class={styles.modalSave} onClick={saveContact}>
                {t('notes.save', language())}
              </button>
            </div>

            {/* Avatar */}
            <div class={styles.editAvatarWrap}>
              <button class={styles.editAvatarBtn} onClick={() => setShowAvatarSheet(true)}>
                <LetterAvatar
                  label={formName() || '?'}
                  color={generateColorForString(formNumber() || 'new')}
                  imageUrl={formAvatar() || undefined}
                  gradient={!formAvatar()}
                  size={80}
                />
              </button>
            </div>

            {/* Form fields */}
            <div class={styles.formFields}>
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
            </div>
          </div>
        </div>
      </Show>

      {/* ═══ Avatar Action Sheet ═══ */}
      <ActionSheet
        open={showAvatarSheet()}
        title="Avatar"
        onClose={() => setShowAvatarSheet(false)}
        actions={[
          { label: t('contacts.avatar.camera', language()), onClick: pickFromCamera },
          { label: t('contacts.avatar.gallery', language()), onClick: () => void pickFromGallery() },
          { label: t('contacts.avatar.url', language()), onClick: () => void pickFromUrl() },
          { label: t('contacts.avatar.remove', language()), tone: 'danger' as const, onClick: removeAvatar },
        ]}
      />

      {/* ═══ Share sheets ═══ */}
      <ActionSheet
        open={!!shareContact() && !shareChannel()}
        title={t('contacts.share_via', language())}
        onClose={() => {
          setShareContact(null);
          setShareChannel(null);
        }}
        actions={[
          { label: 'Compartir NFC', tone: 'primary' as const, onClick: () => nfcShare.open() },
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
