import { For, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeText, sanitizeMediaUrl } from '../../../utils/sanitize';
import { uiConfirm } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { usePhone } from '../../../store/phone';
import { AppScaffold } from '../../shared/layout';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FormSection, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { timeAgo } from '../../../utils/misc';
import { fetchSocketToken } from '../../../utils/realtimeAuth';
import {
  connectMmlSocket, disconnectMmlSocket, isMmlSocketConnected,
  joinMmlRoom, leaveMmlRoom, sendMmlMessage, sendMmlTyping,
  type MmlSocketMessage,
} from '../../../utils/socket';
import styles from './MatchMyLoveApp.module.scss';

interface Profile {
  id: number;
  identifier: string;
  display_name: string;
  age: number;
  bio?: string;
  avatar?: string;
  photos: string[];
  interests: string[];
  gender: string;
  looking_for: string;
  is_active: number;
  created_at?: string;
}

interface Match {
  match_id: number;
  matched_at: string;
  other_identifier: string;
  display_name: string;
  age: number;
  avatar?: string;
  bio?: string;
  last_message?: string;
  last_message_at?: string;
  last_message_sender?: string;
}

interface ChatMessage {
  id: number;
  match_id: number;
  sender_id: string;
  content: string;
  created_at: string;
}

type TabId = 'swipe' | 'matches' | 'profile';

const TABS = [
  { id: 'swipe', label: 'Descubrir' },
  { id: 'matches', label: 'Matches' },
  { id: 'profile', label: 'Perfil' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Hombre' },
  { value: 'female', label: 'Mujer' },
  { value: 'other', label: 'Otro' },
];

const LOOKING_FOR_OPTIONS = [
  { value: 'male', label: 'Hombres' },
  { value: 'female', label: 'Mujeres' },
  { value: 'everyone', label: 'Todos' },
];

export function MatchMyLoveApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';

  const [activeTab, setActiveTab] = createSignal<TabId>('swipe');
  const [profile, setProfile] = createSignal<Profile | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [cards, setCards] = createSignal<Profile[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = createSignal(0);
  const [matches, setMatches] = createSignal<Match[]>([]);
  const [showMatchOverlay, setShowMatchOverlay] = createSignal(false);
  const [matchedName, setMatchedName] = createSignal('');

  // Chat state
  const [activeChat, setActiveChat] = createSignal<Match | null>(null);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [chatInput, setChatInput] = createSignal('');
  const [sendingMessage, setSendingMessage] = createSignal(false);
  const [socketReady, setSocketReady] = createSignal(false);
  const [peerTyping, setPeerTyping] = createSignal(false);
  let typingTimeout: number | undefined;

  // Profile form state
  const [formName, setFormName] = createSignal('');
  const [formAge, setFormAge] = createSignal('');
  const [formBio, setFormBio] = createSignal('');
  const [formAvatar, setFormAvatar] = createSignal('');
  const [formGender, setFormGender] = createSignal('male');
  const [formLookingFor, setFormLookingFor] = createSignal('everyone');
  const [formInterests, setFormInterests] = createSignal('');
  const [formPhotos, setFormPhotos] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  let messageListRef: HTMLDivElement | undefined;

  usePhoneKeyHandler({
    Backspace: () => {
      if (activeChat()) {
        closeChat();
        return;
      }
      router.goBack();
    },
  });

  onMount(async () => {
    const p = await fetchNui<Profile | null>('matchmyloveGetProfile', undefined, null);
    setProfile(p);
    setLoading(false);
    if (p) {
      populateForm(p);
      loadCards();
      loadMatches();
    }
  });

  function populateForm(p: Profile) {
    setFormName(p.display_name || '');
    setFormAge(String(p.age || ''));
    setFormBio(p.bio || '');
    setFormAvatar(p.avatar || '');
    setFormGender(p.gender || 'male');
    setFormLookingFor(p.looking_for || 'everyone');
    setFormInterests((p.interests || []).join(', '));
    setFormPhotos((p.photos || []).join('\n'));
  }

  async function loadCards() {
    const result = await fetchNui<Profile[]>('matchmyloveGetCards', undefined, []);
    setCards(result || []);
    setCurrentCardIndex(0);
  }

  async function loadMatches() {
    const result = await fetchNui<Match[]>('matchmyloveGetMatches', undefined, []);
    setMatches(result || []);
  }

  async function loadMessages(matchId: number) {
    const result = await fetchNui<ChatMessage[]>('matchmyloveGetMessages', { matchId }, []);
    setMessages(result || []);
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (messageListRef) {
        messageListRef.scrollTop = messageListRef.scrollHeight;
      }
    });
  }

  function buildFormData() {
    const interestsRaw = formInterests().split(',').map(s => s.trim()).filter(Boolean);
    const photosRaw = formPhotos().split('\n').map(s => s.trim()).filter(Boolean);
    return {
      display_name: sanitizeText(formName(), 30),
      age: parseInt(formAge(), 10),
      bio: sanitizeText(formBio(), 500),
      avatar: sanitizeMediaUrl(formAvatar()) || undefined,
      gender: formGender(),
      looking_for: formLookingFor(),
      interests: interestsRaw.slice(0, 10),
      photos: photosRaw.slice(0, 6),
    };
  }

  async function handleCreateProfile() {
    setSaving(true);
    const data = buildFormData();
    if (!data.display_name) { uiAlert('Nombre requerido'); setSaving(false); return; }
    if (!data.age || data.age < 18 || data.age > 99) { uiAlert('Edad invalida (18-99)'); setSaving(false); return; }

    const result = await fetchNui<{ success: boolean; message?: string; profile?: Profile }>(
      'matchmyloveCreateProfile', data, { success: false }
    );
    setSaving(false);

    if (result && typeof result === 'object' && 'success' in result) {
      if (!result.success) {
        uiAlert(result.message || 'Error al crear perfil');
        return;
      }
    }

    // Reload profile
    const p = await fetchNui<Profile | null>('matchmyloveGetProfile', undefined, null);
    setProfile(p);
    if (p) {
      populateForm(p);
      loadCards();
    }
  }

  async function handleUpdateProfile() {
    setSaving(true);
    const data = buildFormData();
    if (!data.display_name) { uiAlert('Nombre requerido'); setSaving(false); return; }
    if (!data.age || data.age < 18 || data.age > 99) { uiAlert('Edad invalida (18-99)'); setSaving(false); return; }

    const result = await fetchNui<{ success: boolean; message?: string }>(
      'matchmyloveUpdateProfile', data, { success: false }
    );
    setSaving(false);

    if (result && typeof result === 'object' && 'success' in result) {
      if (!result.success) {
        uiAlert(result.message || 'Error al actualizar');
        return;
      }
    }

    const p = await fetchNui<Profile | null>('matchmyloveGetProfile', undefined, null);
    setProfile(p);
    if (p) populateForm(p);
    uiAlert('Perfil actualizado');
  }

  async function handleDeleteProfile() {
    const confirmed = await uiConfirm('Eliminar tu perfil? Se perderan tus matches y mensajes.');
    if (!confirmed) return;

    await fetchNui('matchmyloveDeleteProfile');
    setProfile(null);
    setCards([]);
    setMatches([]);
    setFormName('');
    setFormAge('');
    setFormBio('');
    setFormAvatar('');
    setFormGender('male');
    setFormLookingFor('everyone');
    setFormInterests('');
    setFormPhotos('');
  }

  async function handleSwipe(direction: 'left' | 'right') {
    const card = cards()[currentCardIndex()];
    if (!card) return;

    const result = await fetchNui<{ success: boolean; message?: string; matched?: boolean; matchId?: number }>(
      'matchmyloveSwipe',
      { targetId: card.identifier, direction },
      { success: false }
    );

    if (result && typeof result === 'object') {
      if ('matched' in result && result.matched) {
        setMatchedName(card.display_name);
        setShowMatchOverlay(true);
        setTimeout(() => setShowMatchOverlay(false), 2500);
        loadMatches();
      }
    }

    // Move to next card
    const nextIndex = currentCardIndex() + 1;
    if (nextIndex >= cards().length) {
      // Reload cards
      await loadCards();
    } else {
      setCurrentCardIndex(nextIndex);
    }
  }

  async function ensureSocket(): Promise<boolean> {
    if (isMmlSocketConnected()) return true;
    const auth = await fetchSocketToken();
    if (!auth.success || !auth.token || !auth.host) return false;

    connectMmlSocket(auth.host, auth.token, {
      onMessage: (msg: MmlSocketMessage) => {
        const chat = activeChat();
        if (!chat || msg.matchId !== chat.match_id) return;
        // Skip own messages (already added optimistically)
        if (msg.senderId === profile()?.identifier) return;
        setMessages(prev => [...prev, {
          id: 0,
          match_id: msg.matchId,
          sender_id: msg.senderId,
          content: msg.content,
          created_at: new Date(msg.createdAt).toISOString(),
        }]);
        scrollToBottom();
      },
      onTyping: (payload) => {
        const chat = activeChat();
        if (!chat || payload.matchId !== chat.match_id) return;
        if (payload.identifier === profile()?.identifier) return;
        setPeerTyping(payload.typing);
        if (typingTimeout) window.clearTimeout(typingTimeout);
        if (payload.typing) {
          typingTimeout = window.setTimeout(() => setPeerTyping(false), 3000);
        }
      },
      onDisconnect: () => setSocketReady(false),
      onReconnect: () => {
        setSocketReady(true);
        const chat = activeChat();
        if (chat) void joinMmlRoom(chat.match_id);
      },
    });
    setSocketReady(true);
    return true;
  }

  onCleanup(() => {
    disconnectMmlSocket();
    if (typingTimeout) window.clearTimeout(typingTimeout);
  });

  async function openChat(match: Match) {
    setActiveChat(match);
    setPeerTyping(false);
    await loadMessages(match.match_id);
    const connected = await ensureSocket();
    if (connected) {
      await joinMmlRoom(match.match_id);
    }
  }

  function closeChat() {
    const chat = activeChat();
    if (chat) leaveMmlRoom(chat.match_id);
    setActiveChat(null);
    setMessages([]);
    setPeerTyping(false);
  }

  async function handleSendMessage() {
    const chat = activeChat();
    if (!chat || sendingMessage()) return;

    const content = sanitizeText(chatInput(), 500);
    if (!content) return;

    setSendingMessage(true);
    setChatInput('');

    if (isMmlSocketConnected()) {
      // Optimistic: add message immediately
      const optimistic: ChatMessage = {
        id: Date.now(),
        match_id: chat.match_id,
        sender_id: profile()?.identifier || '',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
      scrollToBottom();

      const result = await sendMmlMessage(chat.match_id, content);
      setSendingMessage(false);
      if (!result.success) {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m !== optimistic));
      }
    } else {
      // Fallback to NUI callback
      const result = await fetchNui<{ success: boolean; message?: ChatMessage }>(
        'matchmyloveSendMessage',
        { matchId: chat.match_id, content },
        { success: false }
      );
      setSendingMessage(false);
      if (result && typeof result === 'object' && 'message' in result && result.message) {
        setMessages(prev => [...prev, result.message!]);
        scrollToBottom();
      }
    }
  }

  async function handleUnmatch() {
    const chat = activeChat();
    if (!chat) return;

    const confirmed = await uiConfirm('Deshacer match con ' + chat.display_name + '?');
    if (!confirmed) return;

    await fetchNui('matchmyloveUnmatch', { matchId: chat.match_id });
    closeChat();
    loadMatches();
  }

  function getCardPhoto(card: Profile): string | undefined {
    if (card.avatar) return card.avatar;
    if (card.photos && card.photos.length > 0) return card.photos[0];
    return undefined;
  }

  // Fallback NUI message listener (for when socket is unavailable)
  createEffect(() => {
    if (socketReady()) return; // socket handles real-time when connected
    const handler = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'gcphone:matchmylove:newMessage') return;
      const msg = event.data.payload as ChatMessage;
      const chat = activeChat();
      if (chat && msg && msg.match_id === chat.match_id) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  });

  // Setup view (no profile)
  function SetupView() {
    return (
      <div class={styles.profileView}>
        <div class={styles.setupHeader}>
          <div class={styles.setupIcon}>
            <img src="./img/icons_ios/matchmylove.svg" alt="" />
          </div>
          <h2 class={styles.setupTitle}>MatchMyLove</h2>
          <p class={styles.setupSubtitle}>Crea tu perfil para empezar</p>
        </div>
        {ProfileForm(handleCreateProfile, 'Crear Perfil')}
      </div>
    );
  }

  async function attachAvatarFromGallery() {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const images = (gallery || []).filter((item: any) => {
      const url = typeof item === 'string' ? item : item?.url || '';
      return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) || url.startsWith('data:image/');
    });
    if (images.length === 0) { uiAlert('No hay fotos en la galeria'); return; }
    const url = typeof images[0] === 'string' ? images[0] : images[0]?.url || '';
    const sanitized = sanitizeMediaUrl(url);
    if (sanitized) setFormAvatar(sanitized);
  }

  async function attachPhotoFromGallery() {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const images = (gallery || []).filter((item: any) => {
      const url = typeof item === 'string' ? item : item?.url || '';
      return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) || url.startsWith('data:image/');
    });
    if (images.length === 0) { uiAlert('No hay fotos en la galeria'); return; }
    const url = typeof images[0] === 'string' ? images[0] : images[0]?.url || '';
    const sanitized = sanitizeMediaUrl(url);
    if (sanitized) {
      const current = formPhotos().trim();
      setFormPhotos(current ? current + '\n' + sanitized : sanitized);
    }
  }

  function getPhotosArray(): string[] {
    return formPhotos().split('\n').map(s => s.trim()).filter(Boolean);
  }

  function removePhoto(index: number) {
    const photos = getPhotosArray();
    photos.splice(index, 1);
    setFormPhotos(photos.join('\n'));
  }

  function ProfileForm(onSubmit: () => void, submitLabel: string) {
    return (
      <div class={styles.form}>
        <div class={styles.formField}>
          <label class={styles.formLabel}>Nombre</label>
          <input
            class="ios-input"
            type="text"
            value={formName()}
            onInput={(e) => setFormName(e.currentTarget.value)}
            placeholder="Tu nombre..."
            maxLength={30}
          />
        </div>

        <div class={styles.formField}>
          <label class={styles.formLabel}>Edad</label>
          <input
            class="ios-input"
            type="number"
            value={formAge()}
            onInput={(e) => setFormAge(e.currentTarget.value)}
            placeholder="18-99"
            min={18}
            max={99}
          />
        </div>

        <div class={styles.formField}>
          <label class={styles.formLabel}>Bio</label>
          <textarea
            class="ios-textarea"
            value={formBio()}
            onInput={(e) => setFormBio(e.currentTarget.value)}
            placeholder="Algo sobre ti..."
            rows={3}
            maxLength={500}
          />
        </div>

        <div class={styles.formField}>
          <label class={styles.formLabel}>Avatar URL</label>
          <div class={styles.inputWithBtn}>
            <input
              class="ios-input"
              type="url"
              value={formAvatar()}
              onInput={(e) => setFormAvatar(e.currentTarget.value)}
              placeholder="https://..."
            />
            <button class={styles.galleryBtn} onClick={attachAvatarFromGallery} type="button">
              Galeria
            </button>
          </div>
        </div>

        <div class={styles.formRow}>
          <div class={styles.formField}>
            <label class={styles.formLabel}>Genero</label>
            <select
              class="ios-input"
              value={formGender()}
              onChange={(e) => setFormGender(e.currentTarget.value)}
            >
              <For each={GENDER_OPTIONS}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </div>

          <div class={styles.formField}>
            <label class={styles.formLabel}>Busco</label>
            <select
              class="ios-input"
              value={formLookingFor()}
              onChange={(e) => setFormLookingFor(e.currentTarget.value)}
            >
              <For each={LOOKING_FOR_OPTIONS}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </div>
        </div>

        <div class={styles.formField}>
          <label class={styles.formLabel}>Intereses (separados por coma)</label>
          <input
            class="ios-input"
            type="text"
            value={formInterests()}
            onInput={(e) => setFormInterests(e.currentTarget.value)}
            placeholder="musica, deportes, cine..."
          />
        </div>

        <div class={styles.formField}>
          <label class={styles.formLabel}>Fotos (URLs, una por linea)</label>
          <textarea
            class="ios-textarea"
            value={formPhotos()}
            onInput={(e) => setFormPhotos(e.currentTarget.value)}
            placeholder="https://foto1.jpg&#10;https://foto2.jpg"
            rows={3}
          />
          <button class={styles.galleryBtn} onClick={attachPhotoFromGallery} type="button">
            Agregar desde galeria
          </button>
          <Show when={getPhotosArray().length > 0}>
            <div class={styles.photoThumbs}>
              <For each={getPhotosArray()}>
                {(url, i) => (
                  <div class={styles.photoThumb}>
                    <img src={url} alt="" loading="lazy" />
                    <button class={styles.photoThumbRemove} onClick={() => removePhoto(i())} type="button">
                      &times;
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <button
          class={styles.primaryBtn}
          onClick={onSubmit}
          disabled={saving()}
        >
          {saving() ? '...' : submitLabel}
        </button>
      </div>
    );
  }

  // Swipe view
  function SwipeView() {
    const currentCard = () => cards()[currentCardIndex()];

    return (
      <div class={styles.swipeView}>
        <Show when={currentCard()} fallback={
          <EmptyState title="Sin perfiles" description="No hay mas perfiles por ahora" />
        }>
          {(card) => {
            const photo = () => getCardPhoto(card());
            return (
              <div class={styles.card}>
                <div class={styles.cardPhoto}>
                  <Show when={photo()} fallback={
                    <div class={styles.cardPhotoFallback}>
                      <span>{card().display_name.charAt(0).toUpperCase()}</span>
                    </div>
                  }>
                    <img src={photo()!} alt="" loading="lazy" />
                  </Show>
                </div>
                <div class={styles.cardInfo}>
                  <div class={styles.cardName}>
                    {card().display_name}, {card().age}
                  </div>
                  <Show when={card().bio}>
                    <p class={styles.cardBio}>{card().bio}</p>
                  </Show>
                  <Show when={card().interests && card().interests.length > 0}>
                    <div class={styles.interestsList}>
                      <For each={card().interests}>
                        {(interest) => (
                          <span class={styles.interestChip}>{interest}</span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </Show>

        <Show when={currentCard()}>
          <div class={styles.swipeButtons}>
            <button class={styles.rejectBtn} onClick={() => handleSwipe('left')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button class={styles.likeBtn} onClick={() => handleSwipe('right')}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
        </Show>

        <Show when={showMatchOverlay()}>
          <div class={styles.matchOverlay}>
            <div class={styles.matchContent}>
              <div class={styles.matchHeart}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h2 class={styles.matchText}>Es un Match!</h2>
              <p class={styles.matchSubtext}>Tu y {matchedName()} se gustan</p>
            </div>
          </div>
        </Show>
      </div>
    );
  }

  // Matches list view
  function MatchesView() {
    return (
      <div class={styles.matchesView}>
        <Show when={matches().length > 0} fallback={
          <EmptyState title="Sin matches" description="Sigue deslizando para encontrar tu match" />
        }>
          <For each={matches()}>
            {(match) => (
              <button class={styles.matchCard} onClick={() => openChat(match)}>
                <div class={styles.matchAvatar}>
                  <Show when={match.avatar} fallback={
                    <div class={styles.matchAvatarFallback}>
                      {match.display_name.charAt(0).toUpperCase()}
                    </div>
                  }>
                    <img src={match.avatar!} alt="" />
                  </Show>
                </div>
                <div class={styles.matchInfo}>
                  <span class={styles.matchName}>{match.display_name}, {match.age}</span>
                  <Show when={match.last_message}>
                    <span class={styles.matchLastMsg}>{match.last_message}</span>
                  </Show>
                  <Show when={!match.last_message}>
                    <span class={styles.matchLastMsg}>Nuevo match!</span>
                  </Show>
                </div>
                <Show when={match.last_message_at}>
                  <span class={styles.matchTime}>{timeAgo(match.last_message_at!, language())}</span>
                </Show>
              </button>
            )}
          </For>
        </Show>
      </div>
    );
  }

  // Chat view
  function ChatView() {
    const chat = activeChat()!;
    return (
      <div class={styles.chatView}>
        <div class={styles.chatHeader}>
          <button class={styles.chatBackBtn} onClick={closeChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div class={styles.chatHeaderAvatar}>
            <Show when={chat.avatar} fallback={
              <div class={styles.matchAvatarFallback}>
                {chat.display_name.charAt(0).toUpperCase()}
              </div>
            }>
              <img src={chat.avatar!} alt="" />
            </Show>
          </div>
          <span class={styles.chatHeaderName}>{chat.display_name}</span>
          <button class={styles.chatUnmatchBtn} onClick={handleUnmatch}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </button>
        </div>

        <div class={styles.messageList} ref={messageListRef}>
          <Show when={messages().length === 0}>
            <div class={styles.chatEmptyHint}>
              Enviale un mensaje!
            </div>
          </Show>
          <For each={messages()}>
            {(msg) => (
              <div
                class={styles.bubble}
                classList={{ [styles.sent]: msg.sender_id === profile()?.identifier }}
              >
                <p>{msg.content}</p>
                <span class={styles.time}>{timeAgo(msg.created_at, language())}</span>
              </div>
            )}
          </For>
        </div>

        <Show when={peerTyping()}>
          <div class={styles.typingIndicator}>
            <span>{chat.display_name} esta escribiendo...</span>
          </div>
        </Show>

        <div class={styles.chatInputBar}>
          <input
            class="ios-input"
            type="text"
            value={chatInput()}
            onInput={(e) => {
              setChatInput(e.currentTarget.value);
              if (isMmlSocketConnected()) sendMmlTyping(chat.match_id, true);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
            placeholder="Mensaje..."
            maxLength={500}
          />
          <button
            class={styles.sendBtn}
            onClick={handleSendMessage}
            disabled={sendingMessage() || !chatInput().trim()}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Profile editing view
  function ProfileEditView() {
    return (
      <div class={styles.profileView}>
        <div class={styles.profileHeader}>
          <div class={styles.avatarLarge}>
            <Show when={profile()?.avatar} fallback={
              <div class={styles.avatarFallback}>
                {(profile()?.display_name || '?').charAt(0).toUpperCase()}
              </div>
            }>
              <img src={profile()!.avatar!} alt="" />
            </Show>
          </div>
          <h3>{profile()?.display_name}, {profile()?.age}</h3>
        </div>
        {ProfileForm(handleUpdateProfile, 'Guardar Cambios')}
        <button class={styles.dangerBtn} onClick={handleDeleteProfile}>
          Eliminar Perfil
        </button>
      </div>
    );
  }

  return (
    <AppScaffold
      title="MatchMyLove"
      onBack={() => router.goBack()}
      bodyClass={styles.body}
      bodyPadding="none"
    >
      <Show when={!loading()} fallback={<div class={styles.loading}>Cargando...</div>}>
        <Show when={activeChat()}>
          {ChatView()}
        </Show>

        <Show when={!activeChat()}>
          <Show when={!profile()}>
            {SetupView()}
          </Show>

          <Show when={profile()}>
            <div class={styles.matchApp}>
              <div class={styles.tabs}>
                <SegmentedTabs
                  items={TABS}
                  active={activeTab()}
                  onChange={(id) => {
                    setActiveTab(id as TabId);
                    if (id === 'matches') loadMatches();
                    if (id === 'swipe') loadCards();
                  }}
                />
              </div>

              <div class={styles.tabContent}>
                <Show when={activeTab() === 'swipe'}>
                  {SwipeView()}
                </Show>
                <Show when={activeTab() === 'matches'}>
                  {MatchesView()}
                </Show>
                <Show when={activeTab() === 'profile'}>
                  {ProfileEditView()}
                </Show>
              </div>
            </div>
          </Show>
        </Show>
      </Show>
    </AppScaffold>
  );
}
