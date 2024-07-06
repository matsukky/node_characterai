import type { Browser, Page } from 'puppeteer';

declare module 'puppeteer-extra' {
  interface Page {
    deleteCookie(): Promise<void>;
  }
}

interface UserData {
  username: string;
  id: number;
  first_name: string;
  account: any;
  is_staff: boolean;
  subscription: any; // Will be replaced in future as we don't know the exact type of it.
}

interface UserObject {
  user: UserData;
  is_human: boolean;
  name: string;
  email: string;
  needs_to_acknowledge_policy: boolean;
  suspended_until: null | string;
  hidden_characters: any[];
  blocked_users: any[];
  bio: string;
}

interface CharactersData {
  external_id: string;
  title: string;
  greeting: string;
  description: string;
  avatar_file_name: string;
  visibility: string;
  copyable: boolean;
  participant__name: string;
  participant__num_interactions: number;
  user__id: number;
  user__username: string;
  img_gen_enabled: boolean;
  priority: number;
}

declare class Requester {
  browser: Browser | undefined;
  page: Page | undefined;

  #initialized: boolean;
  #hasDisplayed: boolean;

  headless: string;
  puppeteerPath: string | undefined;
  puppeteerLaunchArgs: string[];
  puppeteerNoDefaultTimeout: boolean;
  puppeteerProtocolTimeout: number;
  console: boolean;
  usePlus: boolean;
  forceWaitingRoom: boolean;

  constructor();
  isInitialized(): boolean;
  waitForWaitingRoom(page: Page): Promise<void>;
  initialize(): Promise<void>;
  request(url: string, options: RequestOptions): Promise<any>;
  uninitialize(): Promise<void>;
}

declare class Parser {
  static parseJSON(response: Response): Promise<any>;
  static stringify(text: any): string;
}

declare class OutgoingMessage {
  payload: {
    history_external_id: string | null;
    character_external_id: string | null;
    text: string;
    tgt: string | null;
    ranking_method: string;
    faux_chat: boolean;
    staging: boolean;
    model_server_address: string | null;
    override_prefix: string | null;
    override_rank: string | null;
    rank_candidates: string | null;
    filter_candidates: string | null;
    prefix_limit: string | null;
    prefix_token_limit: string | null;
    livetune_coeff: string | null;
    parent_msg_id: string | null;
    stream_params: string | null;
    enable_tti: boolean;
    initial_timeout: string | null;
    insert_beginning: string | null;
    translate_candidates: string | null;
    stream_every_n_steps: number;
    chunks_to_pad: number;
    is_proactive: boolean;
  };

  constructor(chat: Chat, options: Record<string, any>);
}

declare class Message {
  chat: Chat;
  rawOptions: Record<string, any>;
  uuid: string;
  id: string;
  text: string;
  src: string;
  tgt: string;
  isAlternative: boolean;
  deleted: boolean | null;
  srcName: string;
  srcInternalId: string;
  srcIsHuman: boolean;
  srcCharacterAvatarFileName: string;
  srcCharacterDict: Record<string, any>;
  responsibleUserName: string;
  getPreviousMessage(): Promise<Message | null>;
  delete(deletePreviousToo?: boolean): Promise<void>;
  getAvatarLink(): string;
  returnMessage(): string;
}

declare class Reply {
  constructor(chat: Chat, options: Record<string, any>);
  getMessage(): Promise<Message>;
}

declare class MessageHistory {
  constructor(
    chat: Chat,
    messages: Message[],
    hasMore: boolean,
    nextPage: string | null
  );
}

declare class Chat {
  characterId: string;
  externalId: string | null;
  client: Client;
  aiId: string;
  requester: Requester;

  constructor(client: any, characterId: string, continueBody: any);

  fetchHistory(pageNumber?: number): Promise<MessageHistory>;

  sendAndAwaitResponse(
    optionsOrMessage: Record<string, any> | string,
    singleReply: boolean
  ): Promise<Message[] | Message>;


  changeToConversationId(conversationExternalId: string, force?: boolean): void;

  getSavedConversations(amount?: number): Promise<any>;

  getMessageById(messageId: string): Promise<Message | null>;

  deleteMessage(messageId: string): Promise<void>;

  deleteMessages(messageIds: string[]): Promise<void>;

  deleteMessagesBulk(
    amount: number,
    descending?: boolean,
    printSteps?: boolean
  ): Promise<void>;

  saveAndStartNewChat(): Promise<any>;
}

declare class Client {
  #token: string | undefined;
  #isGuest: boolean;
  #authenticated: boolean;
  #guestHeaders: Record<string, string>;
  requester: Requester;

  constructor();
  fetchCategories(): Promise<any>;
  fetchUserConfig(): Promise<any>;
  fetchUser(): Promise<{ user: UserObject }>;
  fetchFeaturedCharacters(): Promise<CharactersData[]>;
  fetchCharactersByCategory(curated?: boolean): Promise<any>;
  fetchCharacterInfo(characterId: string): Promise<any>;
  searchCharacters(characterName: string): Promise<any>;
  getRecentConversations(): Promise<any>;
  createOrContinueChat(
    characterId: string,
    externalId?: string | null
  ): Promise<Chat>;
  fetchTTS(voiceId: number, toSpeak: string): Promise<string>;
  fetchTTSVoices(): Promise<any>;
  authenticateWithToken(sessionToken: string): Promise<string>;
  authenticateAsGuest(): Promise<string>;
  unauthenticate(): void;
  getToken(): string | undefined;
  isGuest(): boolean;
  isAuthenticated(): boolean;
  getHeaders(): Record<string, string>;
}

interface RequestOptions {
  method: string;
  body: any;
  headers: Record<string, string>;
  mime?: string;
}

export type {
  Message,
  Reply,
  OutgoingMessage,
  MessageHistory,
  Chat,
  Parser,
  Requester,
};

export = Client;