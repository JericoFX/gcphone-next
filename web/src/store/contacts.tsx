import { createContext, useContext, ParentComponent, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { fetchNui } from '../utils/fetchNui';
import { useNuiCustomEvent } from '../utils/useNui';
import type { Contact } from '../types';

interface ContactsState {
  contacts: Contact[];
  loading: boolean;
}

interface ContactsActions {
  fetch: () => Promise<void>;
  add: (display: string, number: string, avatar?: string) => Promise<boolean>;
  update: (id: number, display: string, number: string, avatar?: string) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
  toggleFavorite: (id: number) => Promise<boolean>;
  findByNumber: (number: string) => Contact | undefined;
  findByName: (name: string) => Contact | undefined;
}

type ContactsStore = [ContactsState, ContactsActions];

const ContactsContext = createContext<ContactsStore>();

export const ContactsProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<ContactsState>({
    contacts: [],
    loading: false
  });
  
  const actions: ContactsActions = {
    fetch: async () => {
      setState('loading', true);
      const contacts = await fetchNui<Contact[]>('getContacts', undefined, []);
      setState('contacts', contacts || []);
      setState('loading', false);
    },
    
    add: async (display: string, number: string, avatar?: string) => {
      const result = await fetchNui<{ success: boolean; id?: number; message?: string }>(
        'addContact',
        { display, number, avatar }
      );
      
      if (result?.success) {
        await actions.fetch();
        return true;
      }
      return false;
    },
    
    update: async (id: number, display: string, number: string, avatar?: string) => {
      const result = await fetchNui<{ success: boolean }>(
        'updateContact',
        { id, display, number, avatar }
      );
      
      if (result?.success) {
        await actions.fetch();
        return true;
      }
      return false;
    },
    
    remove: async (id: number) => {
      const result = await fetchNui<{ success: boolean }>('deleteContact', { id });
      
      if (result?.success) {
        setState('contacts', contacts => contacts.filter(contact => contact.id !== id));
        return true;
      }
      return false;
    },
    
    toggleFavorite: async (id: number) => {
      const result = await fetchNui<{ success: boolean }>('toggleFavorite', { id });
      
      if (result?.success) {
        await actions.fetch();
        return true;
      }
      return false;
    },
    
    findByNumber: (number: string) => {
      return state.contacts.find(c => c.number === number);
    },
    
    findByName: (name: string) => {
      return state.contacts.find(c =>
        c.display.toLowerCase().includes(name.toLowerCase())
      );
    }
  };
  
  useNuiCustomEvent<Contact[]>('contactsUpdated', (contacts) => {
    setState('contacts', contacts);
  });
  
  useNuiCustomEvent<Contact>('contactAdded', (contact) => {
    setState('contacts', contacts => [...contacts, contact]);
  });
  
  useNuiCustomEvent<number>('contactDeleted', (id) => {
    setState('contacts', contacts => contacts.filter(contact => contact.id !== id));
  });
  
  onMount(() => {
    actions.fetch();
  });
  
  return (
    <ContactsContext.Provider value={[state, actions]}>
      {props.children}
    </ContactsContext.Provider>
  );
};

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within ContactsProvider');
  }
  return context;
}

export function useContactsState() {
  const [state] = useContacts();
  return state;
}

export function useContactsActions() {
  const [, actions] = useContacts();
  return actions;
}
