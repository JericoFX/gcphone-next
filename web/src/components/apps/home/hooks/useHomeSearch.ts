import { createMemo, createSignal } from 'solid-js';
import { APP_BY_ID } from '../../../../config/apps';
import { appName, t } from '../../../../i18n';
import { fetchNui } from '../../../../utils/fetchNui';

interface SearchContact {
  number: string;
  display: string;
}

interface SearchConversation {
  number: string;
  preview: string;
  time: string;
}

interface SearchCall {
  num: string;
  time: string;
}

export function useHomeSearch(enabledApps: () => string[], language: () => string) {
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [searchContacts, setSearchContacts] = createSignal<SearchContact[]>([]);
  const [searchConversations, setSearchConversations] = createSignal<SearchConversation[]>([]);
  const [searchCalls, setSearchCalls] = createSignal<SearchCall[]>([]);

  const searchResults = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) {
      return {
        apps: [] as Array<{ id: string; name: string; icon: string; route: string }>,
        contacts: [] as SearchContact[],
        conversations: [] as SearchConversation[],
        calls: [] as SearchCall[],
      };
    }

    const apps = enabledApps()
      .map((id) => APP_BY_ID[id])
      .filter((app): app is NonNullable<typeof app> => Boolean(app))
      .filter((app) => {
        const label = appName(app.id, app.name, language()).toLowerCase();
        return label.includes(q) || app.id.toLowerCase().includes(q);
      })
      .slice(0, 6);

    const contacts = searchContacts()
      .filter((entry) => entry.display.toLowerCase().includes(q) || entry.number.toLowerCase().includes(q))
      .slice(0, 6);

    const conversations = searchConversations()
      .filter((entry) => entry.number.toLowerCase().includes(q) || entry.preview.toLowerCase().includes(q))
      .slice(0, 6);

    const calls = searchCalls()
      .filter((entry) => entry.num.toLowerCase().includes(q))
      .slice(0, 6);

    return { apps, contacts, conversations, calls };
  });

  const hasSearchMatches = createMemo(() => {
    const results = searchResults();
    return results.apps.length + results.contacts.length + results.conversations.length + results.calls.length > 0;
  });

  const loadSearchIndex = async () => {
    if (searchLoading()) return;

    setSearchLoading(true);

    try {
      const [contacts, messages, calls] = await Promise.all([
        fetchNui<SearchContact[]>('getContacts', undefined, []),
        fetchNui<Array<{ owner: number; receiver: string; transmitter: string; message: string; time: string }>>('getMessages', undefined, []),
        fetchNui<SearchCall[]>('getCallHistory', undefined, []),
      ]);

      setSearchContacts((contacts || []).slice(0, 300));

      const byNumber = new Map<string, SearchConversation>();
      for (const msg of messages || []) {
        const number = msg.owner === 1 ? msg.receiver : msg.transmitter;
        if (!number || byNumber.has(number)) continue;

        byNumber.set(number, {
          number,
          preview: msg.message || t('home.section_chats', language()),
          time: msg.time,
        });

        if (byNumber.size >= 300) break;
      }

      setSearchConversations(Array.from(byNumber.values()));
      setSearchCalls((calls || []).slice(0, 300));
    } finally {
      setSearchLoading(false);
    }
  };

  const openSearch = () => {
    setSearchOpen(true);

    if (searchContacts().length === 0 && !searchLoading()) {
      void loadSearchIndex();
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  return {
    searchOpen,
    searchQuery,
    searchLoading,
    searchResults,
    hasSearchMatches,
    setSearchQuery,
    openSearch,
    closeSearch,
  };
}
