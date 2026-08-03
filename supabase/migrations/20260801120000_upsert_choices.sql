-- Preserve choice IDs across seed re-runs.
--
-- Before this migration, add_question deleted every choice for a question and
-- re-inserted them on each run. Because public.answers.choice_id is
-- ON DELETE SET NULL, that silently NULLed which option each participant had
-- picked in every game already played, and the game_results views join
-- answers.choice_id = choices.id to compute correct_count. Re-seeding a played
-- quiz therefore blanked its leaderboards. As of this migration 403 of 611
-- answers in production had already lost their choice_id this way.
--
-- Choices are now upserted on (question_id, body) and only genuinely removed
-- options are deleted, so an unchanged re-run touches no choice IDs at all.
--
-- The function body below matches what is actually deployed (the
-- #variable_conflict use_column pragma and the v_question_id local), which
-- drifted from 20260629000000_questions_unique_order.sql in this repo.

ALTER TABLE public.choices
  ADD CONSTRAINT choices_question_id_body_key UNIQUE (question_id, body);

CREATE OR REPLACE FUNCTION public.add_question (
  quiz_set_id uuid,
  body text,
  "order" int,
  choices json[],
  explanation text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $function$
#variable_conflict use_column
DECLARE
  v_question_id uuid;
  choice json;
  v_wanted text[];
BEGIN
  INSERT INTO public.questions (body, "order", quiz_set_id, explanation)
  VALUES (
    add_question.body,
    add_question."order",
    add_question.quiz_set_id,
    add_question.explanation
  )
  ON CONFLICT (quiz_set_id, "order") DO UPDATE
    SET body        = EXCLUDED.body,
        explanation = EXCLUDED.explanation
  RETURNING id INTO v_question_id;

  -- Upsert each option. An option whose body is unchanged keeps its id, so any
  -- answers.choice_id pointing at it survives.
  FOREACH choice IN ARRAY choices
  LOOP
    INSERT INTO public.choices (question_id, body, is_correct)
    VALUES (v_question_id, choice->>'body', (choice->>'is_correct')::boolean)
    ON CONFLICT (question_id, body) DO UPDATE
      SET is_correct = EXCLUDED.is_correct;
  END LOOP;

  -- Prune only the options this question no longer offers.
  SELECT array_agg(c->>'body') INTO v_wanted FROM unnest(choices) AS c;

  DELETE FROM public.choices
   WHERE question_id = v_question_id
     AND NOT (body = ANY (v_wanted));
END;
$function$;
