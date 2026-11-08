"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { LoaderCircle, MessageCircle, Reply, Send } from "lucide-react";
import {
  addComment,
  deleteComment,
  editComment,
} from "@/app/actions/community";
import { AuthorChip } from "@/components/community/author-chip";
import { ReactionBar } from "@/components/community/reaction-bar";
import { EmptyState, buttonClass, inputClass } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import type { CommunityComment } from "@/lib/data/community";
import { useI18n } from "@/lib/i18n/provider";

function CommentComposer({
  recipeId,
  parentId,
  placeholder,
  submitLabel,
  autoFocus,
  onCancel,
  onPosted,
  compact,
}: {
  recipeId: string;
  parentId?: string | null;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  onPosted?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = useId();

  useEffect(() => {
    if (!autoFocus) return;
    const node = textareaRef.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    // Keep mobile keyboard above the composer when possible.
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [autoFocus, parentId]);

  function resize() {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        startTransition(async () => {
          await addComment(fd);
          if (formRef.current) formRef.current.reset();
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
          onPosted?.();
          onCancel?.();
        });
      }}
      className="space-y-2"
    >
      <input type="hidden" name="recipeId" value={recipeId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <label className="sr-only" htmlFor={fieldId}>
        {placeholder}
      </label>
      <div className="flex items-end gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
        <textarea
          ref={textareaRef}
          id={fieldId}
          name="body"
          required
          maxLength={2000}
          rows={1}
          placeholder={placeholder}
          onInput={resize}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="block max-h-28 min-h-[1.5rem] w-full resize-none bg-transparent py-1.5 text-sm text-fg outline-none placeholder:text-muted"
        />
        <div className="flex shrink-0 items-center gap-1 pb-0.5">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:text-fg"
            >
              {t("community.comment.cancelReply")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            aria-label={submitLabel}
            className="grid size-8 place-items-center rounded-full text-brand transition hover:bg-brand-soft disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle size={16} className="animate-spin" aria-hidden />
            ) : (
              <Send size={16} aria-hidden />
            )}
          </button>
        </div>
      </div>
      {!compact ? (
        <p className="px-1 text-[10px] text-muted">{t("community.comment.composerHint")}</p>
      ) : null}
    </form>
  );
}

function CommentNode({
  comment,
  recipeId,
  currentUserId,
  canWrite,
  depth,
  onPosted,
}: {
  comment: CommunityComment;
  recipeId: string;
  currentUserId: string;
  canWrite: boolean;
  depth: number;
  onPosted?: () => void;
}) {
  const { t, locale } = useI18n();
  const [replyOpen, setReplyOpen] = useState(false);
  const isOwn = comment.author.id === currentUserId;

  return (
    <li className="space-y-2">
      <div className="flex gap-2.5 px-1">
        <AuthorChip author={comment.author} t={t} size="sm" avatarOnly />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-fg">
            <span className="font-semibold">{comment.author.displayName}</span>{" "}
            <span className="whitespace-pre-wrap break-words">{comment.body}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            <time dateTime={comment.createdAt}>
              {formatRelativeTime(comment.createdAt, locale)}
            </time>
            {canWrite && depth < 4 ? (
              <button
                type="button"
                onClick={() => setReplyOpen((v) => !v)}
                className="inline-flex items-center gap-1 font-semibold hover:text-fg"
              >
                <Reply size={11} aria-hidden />
                {t("community.comment.reply")}
              </button>
            ) : null}
            {isOwn && canWrite ? (
              <>
                <details className="relative">
                  <summary className="cursor-pointer list-none font-medium hover:text-fg">
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
                  <button type="submit" className="font-medium text-danger hover:underline">
                    {t("community.comment.delete")}
                  </button>
                </form>
              </>
            ) : null}
          </div>
          <div className="mt-1.5">
            <ReactionBar
              recipeId={recipeId}
              commentId={comment.id}
              summary={comment.reactions}
              canReact={canWrite}
              t={t}
              compact
            />
          </div>
          {replyOpen ? (
            <div className="mt-2">
              <CommentComposer
                recipeId={recipeId}
                parentId={comment.id}
                placeholder={t("community.comment.replyPlaceholder")}
                submitLabel={t("community.comment.postReply")}
                autoFocus
                onCancel={() => setReplyOpen(false)}
                onPosted={onPosted}
                compact
              />
            </div>
          ) : null}
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <ul className="ml-8 space-y-2 border-l border-border-soft pl-3">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              recipeId={recipeId}
              currentUserId={currentUserId}
              canWrite={canWrite}
              depth={depth + 1}
              onPosted={onPosted}
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
  compact,
  onPosted,
}: {
  recipeId: string;
  comments: CommunityComment[];
  currentUserId: string;
  canWrite: boolean;
  compact?: boolean;
  onPosted?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {!compact ? (
        <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <MessageCircle size={16} aria-hidden />
          {t("community.commentsTitle")}
        </h4>
      ) : null}

      {canWrite ? (
        <CommentComposer
          recipeId={recipeId}
          placeholder={t("community.comment.placeholder")}
          submitLabel={t("community.comment.post")}
          onPosted={onPosted}
        />
      ) : null}

      {comments.length === 0 ? (
        compact ? (
          <p className="px-1 py-2 text-sm text-muted">{t("community.commentsEmptyBody")}</p>
        ) : (
          <EmptyState
            compact
            icon={<MessageCircle size={20} aria-hidden />}
            title={t("community.commentsEmptyTitle")}
            body={t("community.commentsEmptyBody")}
          />
        )
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              recipeId={recipeId}
              currentUserId={currentUserId}
              canWrite={canWrite}
              depth={0}
              onPosted={onPosted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
