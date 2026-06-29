-- Prevent duplicate questions at the same position within a quiz set.
-- Running a seed SQL twice now upserts rather than inserting duplicates.
ALTER TABLE public.questions
  ADD CONSTRAINT questions_quiz_set_id_order_key UNIQUE (quiz_set_id, "order");

CREATE OR REPLACE FUNCTION add_question (
  quiz_set_id uuid,
  body text,
  "order" int,
  choices json[],
  explanation text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  question_id uuid;
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
  RETURNING id INTO question_id;

  -- Replace choices so a re-run reflects any updated answer options.
  DELETE FROM public.choices WHERE choices.question_id = question_id;
  FOREACH choice IN ARRAY choices
  LOOP
    INSERT INTO public.choices (question_id, body, is_correct)
    VALUES (question_id, choice->>'body', (choice->>'is_correct')::boolean);
  END LOOP;
END;
$$;
