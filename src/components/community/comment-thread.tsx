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
      <div className="rounded-2xl border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <textarea
          ref={textareaRef}
          id={fieldId}
          name="body"
          required
          maxLength={2000}
          rows={compact ? 1 : 2}
          placeholder={placeholder}
          onInput={resize}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="block w-full resize-none bg-transparent px-3 py-2.5 text-sm text-fg outline-none placeholder:text-muted"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <p className="hidden text-[10px] text-muted sm:block">
            {t("community.comment.composerHint")}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg"
              >
                {t("community.comment.cancelReply")}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className={buttonClass("primary", "gap-1.5 text-xs")}
            >
              {pending ? (
                <LoaderCircle size={14} className="animate-spin" aria-hidden />
              ) : (
                <Send size={14} aria-hidden />
              )}
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
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
    <li className="space-y-3">
      <div className="rounded-2xl border border-border-soft bg-surface-2/40 p-3 sm:p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <AuthorChip author={comment.author} t={t} size="sm" />
            <time
              dateTime={comment.createdAt}
              className="mt-1 block text-[10px] text-muted"
            >
              {formatRelativeTime(comment.createdAt, locale)}
            </time>
          </div>
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
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
          {comment.body}
        </p>
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
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-surface hover:text-fg"
            >
              <Reply size={12} aria-hidden />
              {t("community.comment.reply")}
            </button>
          ) : null}
        </div>
        {replyOpen ? (
          <div className="mt-3">
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
      {comment.replies.length > 0 ? (
        <ul className="space-y-3 border-l border-border-soft pl-3 sm:pl-4">
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
              depth={0}
              onPosted={onPosted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
