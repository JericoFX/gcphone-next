export interface ChirpTweet {
  id: number;
  display_name?: string;
  username?: string;
  avatar?: string;
  content: string;
  media_url?: string;
  likes?: number;
  likes_count?: number;
  liked?: boolean;
  rechirps?: number;
  rechirps_count?: number;
  rechirped?: boolean;
  replies?: number;
  comments_count?: number;
  created_at?: string;
  verified?: boolean;
  is_own?: boolean;
  activity_type?: 'tweet' | 'like' | 'rechirp';
  activity_created_at?: string;
  activity_actor_display_name?: string;
  activity_actor_username?: string;
  original_tweet_id?: number;
  original_content?: string;
  original_media_url?: string;
  original_username?: string;
  original_display_name?: string;
  original_avatar?: string;
  original_verified?: boolean;
  rechirp_comment?: string;
  rechirp_media_url?: string;
}

export interface ChirpComment {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  content: string;
  created_at?: string;
}

export interface ChirpFollowRequest {
  id: number;
  account_id: number;
  from_identifier?: string;
  to_identifier?: string;
  username?: string;
  display_name?: string;
  avatar?: string;
  verified?: boolean;
  created_at?: string;
}

export interface ChirpAccount {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
}

export type TabMode = 'forYou' | 'following' | 'myActivity';
