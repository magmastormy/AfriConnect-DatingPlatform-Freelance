export interface SendMessageInput {
  content?: string;
  imageUrl?: string;
}

export interface EditMessageInput {
  content: string;
}

export interface ConversationSummary {
  id: string;
  participant1Id: string;
  participant2Id: string;
  lastMessageAt: Date | null;
}
