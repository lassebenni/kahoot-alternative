-- Fix: the 5-arg add_question overload (added in 20260629000000) failed with
--   ERROR 42702: column reference "quiz_set_id" is ambiguous
-- because ON CONFLICT (quiz_set_id, "order") could refer to either the PL/pgSQL
-- parameters or the questions columns. Any seed SQL calling add_question with an
-- explanation was blocked, so no quiz could be loaded.
--
-- Fix: `#variable_conflict use_column` resolves bare identifiers (in ON CONFLICT
-- and the SET list) to columns, while the explicitly qualified add_question.*
-- references in the VALUES clause still resolve to the parameters.
--
-- Note: the loop variable is renamed question_id -> v_question_id. Under
-- use_column, a bare `question_id` matches the choices.question_id column, so the
-- old `DELETE FROM public.choices WHERE choices.question_id = question_id` would
-- delete EVERY choice (column = column, always true) instead of just this
-- question's. Renaming the variable removes that collision.

CREATE OR REPLACE FUNCTION add_question (
  quiz_set_id uuid,
  body text,
  "order" int,
  choices json[],
  explanation text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
#variable_conflict use_column
DECLARE
  v_question_id uuid;
  choice json;
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

  -- Replace choices so a re-run reflects any updated answer options.
  DELETE FROM public.choices WHERE question_id = v_question_id;
  FOREACH choice IN ARRAY choices
  LOOP
    INSERT INTO public.choices (question_id, body, is_correct)
    VALUES (v_question_id, choice->>'body', (choice->>'is_correct')::boolean);
  END LOOP;
END;
$$;
