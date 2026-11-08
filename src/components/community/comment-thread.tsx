import { MessageCircle } from "lucide-react";
import {
  addComment,
  deleteComment,
  editComment,
} from "@/app/actions/community";
import { AuthorChip } from "@/components/community/author-chip";
import { ReactionBar } from "@/components/community/reaction-bar";
import { EmptyState, buttonClass, inputClass } from "@/components/ui";
import type { CommunityComment } from "@/lib/data/community";
import type { Translate } from "@/lib/i18n";

function CommentNode({
  comment,
  recipeId,
  currentUserId,
  canWrite,
  t,
  depth,
}: {
  comment: CommunityComment;
  recipeId: string;
  currentUserId: string;
  canWrite: boolean;
  t: Translate;
  depth: number;
}) {
  const isOwn = comment.author.id === currentUserId;
  return (
    <li className="space-y-3">
      <div className="rounded-2xl border border-border-soft bg-surface-2/40 p-3 sm:p-3.5">
        <div className="flex items-start justify-between gap-2">
          <AuthorChip author={comment.author} t={t} size="sm" />
          {isOwn && canWrite ? (
            <div className="flex shrink-0 gap-1">
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-[11px] font-medium text-muted hover:text-fg">
                  {t("community.comment.edit")}
                </summary>
                <form action={editComment} className="mt-2 space-y-2">
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input type="hidden" name="recipeId" value={recipeId} />
                  <textarea
                    name="body"
                    required
                    maxLength={2000}
                    defaultValue={comment.body}
                    rows={2}
                    className={inputClass}
                  />
                  <button type="submit" className={buttonClass("secondary", "text-xs")}>
                    {t("community.comment.save")}
                  </button>
                </form>
              </details>
              <form action={deleteComment}>
                <input type="hidden" name="commentId" value={comment.id} />
                <input type="hidden" name="recipeId" value={recipeId} />
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-danger hover:bg-danger/10"
                >
                  {t("community.comment.delete")}
                </button>
              </form>
            </div>
          ) : null}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{comment.body}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <ReactionBar
            recipeId={recipeId}
            commentId={comment.id}
            summary={comment.reactions}
            canReact={canWrite}
            t={t}
            compact
          />
          {canWrite && depth < 4 ? (
            <details>
              <summary className="cursor-pointer list-none text-[11px] font-medium text-muted hover:text-fg">
                {t("community.comment.reply")}
              </summary>
              <form action={addComment} className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="recipeId" value={recipeId} />
                <input type="hidden" name="parentId" value={comment.id} />
                <input
                  name="body"
                  required
                  maxLength={2000}
                  placeholder={t("community.comment.replyPlaceholder")}
                  className={inputClass}
                />
                <button type="submit" className={buttonClass("secondary", "shrink-0 text-xs")}>
                  {t("community.comment.postReply")}
                </button>
              </form>
            </details>
          ) : null}
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <ul className="space-y-3 border-l border-border-soft pl-3 sm:pl-4">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              recipeId={recipeId}
              currentUserId={currentUserId}
              canWrite={canWrite}
              t={t}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentThread({
  recipeId,
  comments,
  currentUserId,
  canWrite,
  t,
}: {
  recipeId: string;
  comments: CommunityComment[];
  currentUserId: string;
  canWrite: boolean;
  t: Translate;
}) {
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <MessageCircle size={16} aria-hidden />
        {t("community.commentsTitle")}
      </h4>

      {comments.length === 0 ? (
        <EmptyState
          compact
          icon={<MessageCircle size={20} aria-hidden />}
          title={t("community.commentsEmptyTitle")}
          body={t("community.commentsEmptyBody")}
        />
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              recipeId={recipeId}
              currentUserId={currentUserId}
              canWrite={canWrite}
              t={t}
              depth={0}
            />
          ))}
        </ul>
      )}

      {canWrite ? (
        <form action={addComment} className="space-y-2 border-t border-border-soft pt-3">
          <input type="hidden" name="recipeId" value={recipeId} />
          <label className="block text-xs font-medium text-muted" htmlFor={`comment-${recipeId}`}>
            {t("community.comment.add")}
          </label>
          <textarea
            id={`comment-${recipeId}`}
            name="body"
            required
            maxLength={2000}
            rows={2}
            placeholder={t("community.comment.placeholder")}
            className={inputClass}
          />
          <button type="submit" className={buttonClass("primary", "text-xs")}>
            {t("community.comment.post")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
