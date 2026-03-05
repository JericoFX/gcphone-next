export function uiAlert(message: string, title = 'Aviso') {
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  if (!safeMessage) return;

  window.dispatchEvent(
    new CustomEvent('phone:uiAlert', {
      detail: {
        title,
        message: safeMessage,
      },
    })
  );
}
