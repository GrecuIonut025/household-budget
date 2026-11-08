import "server-only";
import {
  gradeFromReactionsReceived,
  type CommunityGrade,
} from "@/lib/community/grades";
import {
  emptyReactionCounts,
  type ReactionCounts,
  type ReactionKind,
} from "@/lib/community/reactions";
import { getImageUrls } from "@/lib/data/recipes";
import { createClient } from "@/lib/supabase/server";

export const COMMUNITY_FEED_PAGE_SIZE = 12;

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

export interface CommunityAuthor {
  id: string;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  grade: CommunityGrade;
  reactionsReceived: number;
}

export interface RecipeReactionSummary {
  counts: ReactionCounts;
  mine: ReactionKind[];
  total: number;
}

export interface CommunityComment {
  id: string;
  recipeId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthor;
  reactions: RecipeReactionSummary;
  replies: CommunityComment[];
}

export interface CommunityFeedItem {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: string | null;
  tags: string[];
  imagePath: string | null;
  imageUrl: string | null;
  isFavorite: boolean;
  communityPublishedAt: string;
  author: CommunityAuthor | null;
  reactions: RecipeReactionSummary;
  commentCount: number;
}

export interface CommunityFeedPage {
  items: CommunityFeedItem[];
  nextCursor: { publishedAt: string; id: string } | null;
}

export interface CommunityRecipeSocial {
  recipeId: string;
  author: CommunityAuthor | null;
  reactions: RecipeReactionSummary;
  commentCount: number;
  comments: CommunityComment[];
}

interface FeedRpcRow {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  servings: number | string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  category: string | null;
  tags: string[] | null;
  image_path: string | null;
  is_favorite: boolean;
  community_published_at: string;
  created_by: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  author_grade: number | null;
  author_reactions_received: number | null;
  reaction_like: number;
  reaction_useful: number;
  reaction_love: number;
  comment_count: number;
}

interface CommentRow {
  id: string;
  recipe_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface ReactionRow {
  id: string;
  user_id: string;
  kind: ReactionKind;
  recipe_id: string | null;
  comment_id: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_path: string | null;
  community_grade: number | null;
  community_reactions_received: number | null;
}

function summariseReactions(
  rows: ReactionRow[],
  currentUserId: string,
): RecipeReactionSummary {
  const counts = emptyReactionCounts();
  const mine: ReactionKind[] = [];
  for (const row of rows) {
    counts[row.kind] += 1;
    if (row.user_id === currentUserId && !mine.includes(row.kind)) {
      mine.push(row.kind);
    }
  }
  return {
    counts,
    mine,
    total: counts.like + counts.useful + counts.love,
  };
}

function authorFromProfile(
  profile: ProfileRow | null | undefined,
  avatarUrls: Record<string, string>,
  fallbackId?: string,
): CommunityAuthor | null {
  if (!profile && !fallbackId) return null;
  if (!profile) {
    return {
      id: fallbackId!,
      displayName: "—",
      avatarPath: null,
      avatarUrl: null,
      grade: 1,
      reactionsReceived: 0,
    };
  }
  const received = profile.community_reactions_received ?? 0;
  return {
    id: profile.id,
    displayName: profile.display_name || "—",
    avatarPath: profile.avatar_path,
    avatarUrl: profile.avatar_path ? (avatarUrls[profile.avatar_path] ?? null) : null,
    grade: (profile.community_grade as CommunityGrade) || gradeFromReactionsReceived(received),
    reactionsReceived: received,
  };
}

async function loadProfiles(userIds: string[]): Promise<Map<string, ProfileRow>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ProfileRow>();
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, community_grade, community_reactions_received")
    .in("id", unique);
  if (error) fail("profiles", error.message);
  for (const row of (data ?? []) as ProfileRow[]) map.set(row.id, row);
  return map;
}

async function myReactionsForRecipes(
  recipeIds: string[],
  userId: string,
): Promise<Map<string, ReactionKind[]>> {
  const map = new Map<string, ReactionKind[]>();
  if (recipeIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_reactions")
    .select("recipe_id, kind")
    .eq("user_id", userId)
    .in("recipe_id", recipeIds);
  if (error) fail("my reactions", error.message);
  for (const row of data ?? []) {
    const id = row.recipe_id as string;
    const list = map.get(id) ?? [];
    list.push(row.kind as ReactionKind);
    map.set(id, list);
  }
  return map;
}

export async function getCommunityFeedPage(options: {
  currentUserId: string;
  limit?: number;
  cursorPublishedAt?: string | null;
  cursorId?: string | null;
}): Promise<CommunityFeedPage> {
  const limit = Math.min(Math.max(options.limit ?? COMMUNITY_FEED_PAGE_SIZE, 1), 30);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_feed_page", {
    p_limit: limit,
    p_cursor_published_at: options.cursorPublishedAt ?? null,
    p_cursor_id: options.cursorId ?? null,
  });
  if (error) fail("community feed", error.message);

  const rows = (data ?? []) as FeedRpcRow[];
  const imageUrls = await getImageUrls(rows.map((r) => r.image_path));
  const avatarUrls = await getImageUrls(rows.map((r) => r.author_avatar_path));
  const mine = await myReactionsForRecipes(
    rows.map((r) => r.id),
    options.currentUserId,
  );

  const items: CommunityFeedItem[] = rows.map((row) => {
    const counts: ReactionCounts = {
      like: Number(row.reaction_like) || 0,
      useful: Number(row.reaction_useful) || 0,
      love: Number(row.reaction_love) || 0,
    };
    const myKinds = mine.get(row.id) ?? [];
    const author: CommunityAuthor | null = row.created_by
      ? {
          id: row.created_by,
          displayName: row.author_display_name || "—",
          avatarPath: row.author_avatar_path,
          avatarUrl: row.author_avatar_path
            ? (avatarUrls[row.author_avatar_path] ?? null)
            : null,
          grade: (row.author_grade as CommunityGrade) || 1,
          reactionsReceived: Number(row.author_reactions_received) || 0,
        }
      : null;

    return {
      id: row.id,
      householdId: row.household_id,
      title: row.title,
      description: row.description,
      servings: Number(row.servings),
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      category: row.category,
      tags: row.tags ?? [],
      imagePath: row.image_path,
      imageUrl: row.image_path ? (imageUrls[row.image_path] ?? null) : null,
      isFavorite: row.is_favorite,
      communityPublishedAt: row.community_published_at,
      author,
      reactions: {
        counts,
        mine: myKinds,
        total: counts.like + counts.useful + counts.love,
      },
      commentCount: Number(row.comment_count) || 0,
    };
  });

  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      items.length === limit && last
        ? { publishedAt: last.communityPublishedAt, id: last.id }
        : null,
  };
}

/** Load comments + reactions for one post (lazy / detail). */
export async function getCommunityPostSocial(
  recipeId: string,
  currentUserId: string,
): Promise<CommunityRecipeSocial> {
  const supabase = await createClient();

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, created_by, community_published_at")
    .eq("id", recipeId)
    .maybeSingle();
  if (recipeError) fail("recipe", recipeError.message);
  if (!recipe || !recipe.community_published_at) {
    return {
      recipeId,
      author: null,
      reactions: { counts: emptyReactionCounts(), mine: [], total: 0 },
      commentCount: 0,
      comments: [],
    };
  }

  const [{ data: commentsRaw, error: commentsError }, { data: recipeReactions, error: rrError }] =
    await Promise.all([
      supabase
        .from("community_comments")
        .select("id, recipe_id, parent_id, author_id, body, created_at, updated_at")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("community_reactions")
        .select("id, user_id, kind, recipe_id, comment_id")
        .eq("recipe_id", recipeId),
    ]);
  if (commentsError) fail("comments", commentsError.message);
  if (rrError) fail("reactions", rrError.message);

  const comments = (commentsRaw ?? []) as CommentRow[];
  const commentIds = comments.map((c) => c.id);

  let commentReactions: ReactionRow[] = [];
  if (commentIds.length > 0) {
    const { data, error } = await supabase
      .from("community_reactions")
      .select("id, user_id, kind, recipe_id, comment_id")
      .in("comment_id", commentIds);
    if (error) fail("comment reactions", error.message);
    commentReactions = (data ?? []) as ReactionRow[];
  }

  const authorIds = [
    recipe.created_by as string | null,
    ...comments.map((c) => c.author_id),
  ].filter((id): id is string => !!id);
  const profiles = await loadProfiles(authorIds);
  const avatarUrls = await getImageUrls(
    [...profiles.values()].map((p) => p.avatar_path),
  );

  const reactionsByComment = new Map<string, ReactionRow[]>();
  for (const row of commentReactions) {
    if (!row.comment_id) continue;
    const list = reactionsByComment.get(row.comment_id) ?? [];
    list.push(row);
    reactionsByComment.set(row.comment_id, list);
  }

  function toNode(row: CommentRow, all: CommentRow[]): CommunityComment {
    return {
      id: row.id,
      recipeId: row.recipe_id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author:
        authorFromProfile(profiles.get(row.author_id), avatarUrls, row.author_id) ?? {
          id: row.author_id,
          displayName: "—",
          avatarPath: null,
          avatarUrl: null,
          grade: 1,
          reactionsReceived: 0,
        },
      reactions: summariseReactions(reactionsByComment.get(row.id) ?? [], currentUserId),
      replies: all.filter((c) => c.parent_id === row.id).map((c) => toNode(c, all)),
    };
  }

  const roots = comments.filter((c) => c.parent_id === null).map((c) => toNode(c, comments));
  const createdBy = recipe.created_by as string | null;

  return {
    recipeId,
    author: createdBy
      ? authorFromProfile(profiles.get(createdBy), avatarUrls, createdBy)
      : null,
    reactions: summariseReactions((recipeReactions ?? []) as ReactionRow[], currentUserId),
    commentCount: comments.length,
    comments: roots,
  };
}

export async function getMemberCommunityProfile(
  userId: string,
): Promise<CommunityAuthor | null> {
  const profiles = await loadProfiles([userId]);
  const profile = profiles.get(userId);
  if (!profile) return null;
  const avatarUrls = await getImageUrls([profile.avatar_path]);
  return authorFromProfile(profile, avatarUrls, userId);
}

export async function getMemberPublishedRecipes(
  userId: string,
  currentUserId: string,
  limit = 24,
): Promise<CommunityFeedPage> {
  // Reuse feed RPC then filter client-side would be wasteful; query published by author with keyset.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, household_id, title, description, servings, prep_minutes, cook_minutes, category, tags, image_path, is_favorite, community_published_at, created_by",
    )
    .eq("created_by", userId)
    .not("community_published_at", "is", null)
    .order("community_published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) fail("member recipes", error.message);

  const rows = data ?? [];
  if (rows.length === 0) return { items: [], nextCursor: null };

  const ids = rows.map((r) => r.id as string);
  const imageUrls = await getImageUrls(rows.map((r) => r.image_path as string | null));
  const profile = await getMemberCommunityProfile(userId);
  const mine = await myReactionsForRecipes(ids, currentUserId);

  // Aggregate counts in two queries (no N+1)
  const { data: reactionRows, error: reactError } = await supabase
    .from("community_reactions")
    .select("recipe_id, kind")
    .in("recipe_id", ids);
  if (reactError) fail("member reactions", reactError.message);
  const { data: commentRows, error: commentError } = await supabase
    .from("community_comments")
    .select("recipe_id")
    .in("recipe_id", ids);
  if (commentError) fail("member comments", commentError.message);

  const countsByRecipe = new Map<string, ReactionCounts>();
  for (const id of ids) countsByRecipe.set(id, emptyReactionCounts());
  for (const row of reactionRows ?? []) {
    const id = row.recipe_id as string;
    const counts = countsByRecipe.get(id) ?? emptyReactionCounts();
    counts[row.kind as ReactionKind] += 1;
    countsByRecipe.set(id, counts);
  }
  const commentCount = new Map<string, number>();
  for (const row of commentRows ?? []) {
    const id = row.recipe_id as string;
    commentCount.set(id, (commentCount.get(id) ?? 0) + 1);
  }

  const items: CommunityFeedItem[] = rows.map((row) => {
    const id = row.id as string;
    const counts = countsByRecipe.get(id) ?? emptyReactionCounts();
    return {
      id,
      householdId: row.household_id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      servings: Number(row.servings),
      prepMinutes: (row.prep_minutes as number | null) ?? null,
      cookMinutes: (row.cook_minutes as number | null) ?? null,
      category: (row.category as string | null) ?? null,
      tags: (row.tags as string[] | null) ?? [],
      imagePath: (row.image_path as string | null) ?? null,
      imageUrl: row.image_path ? (imageUrls[row.image_path as string] ?? null) : null,
      isFavorite: Boolean(row.is_favorite),
      communityPublishedAt: row.community_published_at as string,
      author: profile,
      reactions: {
        counts,
        mine: mine.get(id) ?? [],
        total: counts.like + counts.useful + counts.love,
      },
      commentCount: commentCount.get(id) ?? 0,
    };
  });

  return { items, nextCursor: null };
}

export interface NotificationRow {
  id: string;
  kind: string;
  actorId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  recipeId: string | null;
  commentId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(
  userId: string,
  limit = 20,
): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  const supabase = await createClient();
  const capped = Math.min(Math.max(limit, 1), 40);

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, actor_id, recipe_id, comment_id, payload, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(capped),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);
  if (error) fail("notifications", error.message);
  if (countError) fail("unread count", countError.message);

  const rows = data ?? [];
  const actorIds = rows
    .map((r) => r.actor_id as string | null)
    .filter((id): id is string => !!id);
  const profiles = await loadProfiles(actorIds);
  const avatarUrls = await getImageUrls(
    [...profiles.values()].map((p) => p.avatar_path),
  );

  return {
    unreadCount: count ?? 0,
    items: rows.map((r) => {
      const actor = r.actor_id
        ? profiles.get(r.actor_id as string)
        : undefined;
      const avatarPath = actor?.avatar_path ?? null;
      return {
        id: r.id as string,
        kind: r.kind as string,
        actorId: (r.actor_id as string | null) ?? null,
        actorName: actor?.display_name ?? null,
        actorAvatarUrl: avatarPath ? (avatarUrls[avatarPath] ?? null) : null,
        recipeId: (r.recipe_id as string | null) ?? null,
        commentId: (r.comment_id as string | null) ?? null,
        payload: (r.payload as Record<string, unknown>) ?? {},
        readAt: (r.read_at as string | null) ?? null,
        createdAt: r.created_at as string,
      };
    }),
  };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}
