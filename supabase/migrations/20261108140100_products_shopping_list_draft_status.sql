-- Lists generated automatically (e.g. a recurring list built from purchase history) start as drafts
-- until the household reviews them. Own file: a new enum value cannot be used in the transaction that adds it.
alter type public.shopping_list_status add value if not exists 'draft' before 'active';
