import { createSignal, Show, onCleanup, onMount } from 'solid-js';
import { usePhoneState } from '../../../store/phone';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { fetchNui } from '../../../utils/fetchNui';
import { formatPhoneNumber } from '../../../utils/misc';
import type { ContactRequest, FriendRequest, SharedLocation } from '../../../types';
import styles from './ContactRequest.module.scss';

export function ContactRequestNotification() {
  const phoneState = usePhoneState();
  const [contactRequest, setContactRequest] = createSignal<ContactRequest | null>(null);
  const [friendRequest, setFriendRequest] = createSignal<FriendRequest | null>(null);
  const [sharedLocation, setSharedLocation] = createSignal<SharedLocation | null>(null);
  let locationTimer: number | undefined;

  onCleanup(() => {
    if (locationTimer) window.clearTimeout(locationTimer);
  });

  useNuiCustomEvent<ContactRequest>('receiveContactRequest', (data) => {
    setContactRequest(data);
  });

  useNuiCustomEvent<FriendRequest>('receiveFriendRequest', (data) => {
    setFriendRequest(data);
  });

  useNuiCustomEvent<SharedLocation>('receiveSharedLocation', (data) => {
    if (locationTimer) window.clearTimeout(locationTimer);
    setSharedLocation(data);
    locationTimer = window.setTimeout(() => setSharedLocation(null), 5000);
  });
  
  const handleAcceptContact = async () => {
    const request = contactRequest();
    if (!request) return;
    
    await fetchNui('acceptContactRequest', {
      fromServerId: request.fromServerId,
      display: request.contact.display,
      number: request.contact.number,
      avatar: request.contact.avatar
    });
    
    setContactRequest(null);
  };
  
  const handleRejectContact = () => {
    setContactRequest(null);
  };
  
  const handleAcceptFriend = async () => {
    const request = friendRequest();
    if (!request) return;
    
    await fetchNui('acceptFriendRequest', {
      fromServerId: request.fromServerId,
      type: request.type
    });

    setFriendRequest(null);
  };

  const handleRejectFriend = async () => {
    const request = friendRequest();
    if (!request) return;

    await fetchNui('rejectFriendRequest', {
      fromServerId: request.fromServerId,
      type: request.type
    });
    
    setFriendRequest(null);
  };
  
  return (
    <>
      <Show when={contactRequest()}>
        {(request) => (
          <div class={styles.notification}>
            <div class={styles.icon}><img src="./img/icons_ios/ui-phone.svg" alt="" draggable={false} /></div>
            <div class={styles.content}>
              <div class={styles.title}>Solicitud de contacto</div>
              <div class={styles.message}>{request().fromPlayer} quiere compartir un contacto</div>
              <div class={styles.contact}>
                <strong>{request().contact.display}</strong>
                <span>{formatPhoneNumber(request().contact.number, phoneState.framework || 'unknown')}</span>
              </div>
            </div>
            <div class={styles.actions}>
              <button class={styles.accept} onClick={handleAcceptContact}><img src="./img/icons_ios/ui-check.svg" alt="" draggable={false} /></button>
              <button class={styles.reject} onClick={handleRejectContact}><img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} /></button>
            </div>
          </div>
        )}
      </Show>
      
      <Show when={friendRequest()}>
        {(request) => (
          <div class={styles.notification}>
            <div class={styles.icon}><img src="./img/icons_ios/ui-user.svg" alt="" draggable={false} /></div>
            <div class={styles.content}>
              <div class={styles.title}>Solicitud de amistad ({request().type})</div>
              <div class={styles.message}>{request().fromPlayer} quiere ser tu amigo</div>
            </div>
            <div class={styles.actions}>
              <button class={styles.accept} onClick={handleAcceptFriend}><img src="./img/icons_ios/ui-check.svg" alt="" draggable={false} /></button>
              <button class={styles.reject} onClick={handleRejectFriend}><img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} /></button>
            </div>
          </div>
        )}
      </Show>
      
      <Show when={sharedLocation()}>
        {(location) => (
          <div class={styles.notification}>
            <div class={styles.icon}><img src="./img/icons_ios/ui-location.svg" alt="" draggable={false} /></div>
            <div class={styles.content}>
              <div class={styles.title}>Ubicación compartida</div>
              <div class={styles.message}>{location().from} te ha compartido su ubicación</div>
            </div>
            <div class={styles.actions}>
              <button 
                class={styles.accept}
                onClick={() => {
                  fetchNui('setGPS', { x: location().x, y: location().y });
                  setSharedLocation(null);
                }}
              >
                <img src="./img/icons_ios/maps.svg" alt="" draggable={false} />
              </button>
              <button class={styles.reject} onClick={() => setSharedLocation(null)}><img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} /></button>
            </div>
          </div>
        )}
      </Show>
    </>
  );
}
