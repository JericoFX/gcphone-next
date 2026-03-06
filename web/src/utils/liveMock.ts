export interface MockLiveMessage {
  id: string;
  user: string;
  text: string;
  isMention: boolean;
  createdAt: number;
}

export interface MockLiveReaction {
  id: string;
  user: string;
  reaction: string;
  createdAt: number;
}

interface StartMockLiveOptions {
  users: string[];
  lines: string[];
  mentionTarget?: string;
  reactions?: string[];
  messageIntervalMs?: number;
  reactionIntervalMs?: number;
  onMessage: (entry: MockLiveMessage) => void;
  onReaction?: (entry: MockLiveReaction) => void;
}

export function startMockLiveFeed(options: StartMockLiveOptions) {
  const users = options.users.length > 0 ? options.users : ['viewer'];
  const lines = options.lines.length > 0 ? options.lines : ['Hola'];
  const reactions = options.reactions && options.reactions.length > 0
    ? options.reactions
    : ['👍', '❤️', '😂', '🔥', '👏'];

  const messageTick = window.setInterval(() => {
    const user = users[Math.floor(Math.random() * users.length)];
    const textRaw = lines[Math.floor(Math.random() * lines.length)];
    const mention = options.mentionTarget || '';
    const finalText = mention && Math.random() < 0.24 ? `${mention} ${textRaw}` : textRaw;
    options.onMessage({
      id: `${Date.now()}-${Math.random()}`,
      user,
      text: finalText,
      isMention: mention ? finalText.includes(mention) : false,
      createdAt: Date.now(),
    });
  }, options.messageIntervalMs || 2200);

  let reactionTick: number | undefined;
  if (options.onReaction) {
    reactionTick = window.setInterval(() => {
      options.onReaction?.({
        id: `${Date.now()}-${Math.random()}`,
        user: users[Math.floor(Math.random() * users.length)],
        reaction: reactions[Math.floor(Math.random() * reactions.length)],
        createdAt: Date.now(),
      });
    }, options.reactionIntervalMs || 3500);
  }

  return () => {
    window.clearInterval(messageTick);
    if (reactionTick) {
      window.clearInterval(reactionTick);
    }
  };
}
