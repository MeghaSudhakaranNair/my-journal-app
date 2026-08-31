alter table public.journal_entries
add column sentiment_label text,
add column sentiment_confidence double precision,
add column sentiment_scores jsonb,
add column sentiment_model text,
add column sentiment_chunks integer,
add column sentiment_tokens integer;

alter table public.journal_entries
add constraint journal_entries_sentiment_label_check
check (
  sentiment_label is null
  or sentiment_label in ('negative', 'neutral', 'positive')
),
add constraint journal_entries_sentiment_confidence_check
check (
  sentiment_confidence is null
  or sentiment_confidence between 0 and 1
),
add constraint journal_entries_sentiment_scores_check
check (
  sentiment_scores is null
  or jsonb_typeof(sentiment_scores) = 'object'
),
add constraint journal_entries_sentiment_chunks_check
check (
  sentiment_chunks is null
  or sentiment_chunks >= 1
),
add constraint journal_entries_sentiment_tokens_check
check (
  sentiment_tokens is null
  or sentiment_tokens >= 1
);
