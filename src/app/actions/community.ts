"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, getActionTranslator } from "@/lib/actions";
import { isReactionKind } from "@/lib/community/reactions";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();

function revalidateCommunity(recipeId?: string) {
  revalidatePath("/community");
  revalidatePath("/", "layout");
  if (recipeId) {
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath(`/community/members`);
  }
}

export async function publishRecipeToCommunity(formData: FormData): Promise<void> {
  const t = await getActionTranslator();
  const householdId = uuid.safeParse(formData.get("householdId"));
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  if (!householdId.success || !recipeId.success) {
    throw new Error(t("common.errorGeneric"));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ community_published_at: new Date().toISOString() })
    .eq("id", recipeId.data)
    .eq("household_id", householdId.data)
    .is("community_published_at", null);
  if (error) throw new Error(describeDbError(error, t));
  revalidateCommunity(recipeId.data);
}

export async function unpublishRecipeFromCommunity(formData: FormData): Promise<void> {
  const t = await getActionTranslator();
  const householdId = uuid.safeParse(formData.get("householdId"));
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  if (!householdId.success || !recipeId.success) {
    throw new Error(t("common.errorGeneric"));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ community_published_at: null })
    .eq("id", recipeId.data)
    .eq("household_id", householdId.data);
  if (error) throw new Error(describeDbError(error, t));
  revalidateCommunity(recipeId.data);
}

export async function toggleRecipeReaction(formData: FormData): Promise<void> {
  const t = await getActionTranslator();
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  const kindRaw = formData.get("kind");
  if (!recipeId.success || !isReactionKind(kindRaw)) {
    throw new Error(t("common.errorGeneric"));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t("common.noPermission"));

  const { data: existing } = await supabase
    .from("community_reactions")
    .select("id")
    .eq("recipe_id", recipeId.data)
    .eq("user_id", user.id)
    .eq("kind", kindRaw)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("community_reactions").delete().eq("id", existing.id);
    if (error) throw new Error(describeDbError(error, t));
  } else {
    const { error } = await supabase.from("community_reactions").insert({
      recipe_id: recipeId.data,
      user_id: user.id,
      kind: kindRaw,
    });
    if (error) throw new Error(describeDbError(error, t));
  }

  revalidateCommunity(recipeId.data);
}

export async function toggleCommentReaction(formData: FormData): Promise<void> {
  const t = await getActionTranslator();
  const commentId = uuid.safeParse(formData.get("commentId"));
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  const kindRaw = formData.get("kind");
  if (!commentId.success || !isReactionKind(kindRaw)) {
    throw new Error(t("common.errorGeneric"));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t("common.noPermission"));

  const { data: existing } = await supabase
    .from("community_reactions")
    .select("id")
    .eq("comment_id", commentId.data)
    .eq("user_id", user.id)
    .eq("kind", kindRaw)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("community_reactions").delete().eq("id", existing.id);
    if (error) throw new Error(describeDbError(error, t));
  } else {
    const { error } = await supabase.from("community_reactions").insert({
      comment_id: commentId.data,
      user_id: user.id,
      kind: kindRaw,
    });
    if (error) throw new Error(describeDbError(error, t));
  }

  revalidateCommunity(recipeId.success ? recipeId.data : undefined);
}

export async function addComment(formData: FormData): Promise<void> {
  const t = await getActionTranslator();
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  const parentRaw = formData.get("parentId");
  const parentId =
    typeof parentRaw === "string" && parentRaw.length > 0 ? uuid.safeParse(parentRaw) : null;
  if (parentId && !parentId.success) throw new Error(t("common.errorGeneric"));
  const body = typeof formData.get("body") === "string" ? String(formData.get("body")).trim() : "";
  if (!recipeId.success || body.length < 1 || body.length > 2000) {
    throw new Error(t("community.comment.invalid"));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t("common.noPermission"));

  const { error } = await supabase.from("community_comments").insert({
    recipe_id: recipeId.data,
    parent_id: parentId?.success ? parentId.data : null,
    author_id: user.id,
    body,
  });
  if (error) throw new Error(describeDbError(error, t));
  revalidateCommunity(recipeId.data);
}

export async function editComment(formData: FormData): Promise<void> {
  const t = await getActionTranslator();
  const commentId = uuid.safeParse(formData.get("commentId"));
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  const body = typeof formData.get("body") === "string" ? String(formData.get("body")).trim() : "";
  if (!commentId.success || body.length < 1 || body.length > 2000) {
    throw new Error(t("community.comment.invalid"));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("community_comments")
    .update({ body })
    .eq("id", commentId.data);
  if (error) throw new Error(describeDbError(error, t));
  revalidateCommunity(recipeId.success ? recipeId.data : undefined);
}

export async function deleteComment(formData: FormData): Promise<void> {
  const t = await getActionTranslator();
  const commentId = uuid.safeParse(formData.get("commentId"));
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  if (!commentId.success) throw new Error(t("common.errorGeneric"));

  const supabase = await createClient();
  const { error } = await supabase.from("community_comments").delete().eq("id", commentId.data);
  if (error) throw new Error(describeDbError(error, t));
  revalidateCommunity(recipeId.success ? recipeId.data : undefined);
}

export async function markNotificationsRead(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const idRaw = formData.get("id");
  if (typeof idRaw === "string" && idRaw.length > 0) {
    const id = uuid.safeParse(idRaw);
    if (!id.success) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id.data)
      .eq("user_id", user.id)
      .is("read_at", null);
  } else {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
  }
  revalidatePath("/", "layout");
  revalidatePath("/community");
}
