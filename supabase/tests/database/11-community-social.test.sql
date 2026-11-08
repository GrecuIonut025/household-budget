begin;
select plan(15);

select tests.seed_fixture();

select has_table('public', 'community_comments', 'community_comments exists');
select has_table('public', 'community_reactions', 'community_reactions exists');
select has_table('public', 'notifications', 'notifications exists');

-- Publish a recipe to the global feed
select tests.as_user('alice');
select lives_ok(
  $$ update public.recipes
     set community_published_at = now(), created_by = tests.id('alice')
     where id = tests.id('A-recipe') $$,
  'owner can publish recipe to community'
);

-- Global visibility: dave (other household) can read the published recipe
select tests.as_user('dave');
select is(
  (select count(*)::int from public.recipes where id = tests.id('A-recipe') and community_published_at is not null),
  1,
  'authenticated users can read published community recipes'
);

-- Comments + reactions across households
select tests.as_user('dave');
select lives_ok(
  $$ insert into public.community_comments (id, recipe_id, body, author_id)
     values (tests.id('c1'), tests.id('A-recipe'), 'Looks tasty', tests.id('dave')) $$,
  'any authenticated user can comment on a published post'
);
select lives_ok(
  $$ insert into public.community_reactions (recipe_id, kind, user_id)
     values (tests.id('A-recipe'), 'love', tests.id('dave')) $$,
  'any authenticated user can react'
);

-- Author notified (love + reaction coalesced / present)
select tests.as_user('alice');
select ok(
  (select count(*)::int from public.notifications where user_id = tests.id('alice') and kind in ('reaction_love', 'reaction_post')) >= 1,
  'recipe author receives reaction notification'
);

-- Reply notifies parent author
select tests.as_user('bob');
select lives_ok(
  $$ insert into public.community_comments (id, recipe_id, parent_id, body, author_id)
     values (tests.id('c2'), tests.id('A-recipe'), tests.id('c1'), 'Agreed!', tests.id('bob')) $$,
  'threaded reply works'
);
select tests.as_user('dave');
select ok(
  (select count(*)::int from public.notifications where user_id = tests.id('dave') and kind = 'comment_reply') >= 1,
  'parent author receives reply notification'
);

-- Author edit/delete own; other member cannot delete
select tests.as_user('dave');
select lives_ok(
  $$ update public.community_comments set body = 'Looks great' where id = tests.id('c1') $$,
  'author can edit own comment'
);
select tests.as_user('bob');
select is_empty(
  $$ delete from public.community_comments where id = tests.id('c1') returning id $$,
  'non-author cannot delete comment'
);
select tests.as_user('dave');
select lives_ok(
  $$ delete from public.community_comments where id = tests.id('c1') $$,
  'author can delete own comment'
);

-- Feed RPC returns the published row
select tests.as_user('bob');
select ok(
  (select count(*)::int from public.community_feed_page(12, null, null) where id = tests.id('A-recipe')) = 1,
  'community_feed_page returns published posts'
);

-- Notifications are recipient-private
select tests.as_user('bob');
select is(
  (select count(*)::int from public.notifications where user_id = tests.id('alice')),
  0,
  'users cannot read others notifications'
);

select * from finish();
rollback;
