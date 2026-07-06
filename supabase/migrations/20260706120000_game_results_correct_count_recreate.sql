-- The 20260601120000 migration added correct_count to the game_results view via
-- CREATE OR REPLACE VIEW, but it inserts correct_count *before* the existing
-- game_id column. Postgres rejects that ("cannot change name of view column
-- game_id to correct_count") because CREATE OR REPLACE VIEW can only append
-- columns at the end. As a result the column never reached the hosted DB and
-- the host results page failed with "column game_results.correct_count does not
-- exist". DROP + CREATE recreates the view with the new column in place.

drop view if exists public.game_results;

create view public.game_results as
    select
        participants.id as participant_id,
        participants.nickname,
        sum(answers.score) as total_score,
        count(*) filter (where choices.is_correct) as correct_count,
        games.id as game_id
    from games
    inner join quiz_sets on games.quiz_set_id = quiz_sets.id
    inner join questions on quiz_sets.id = questions.quiz_set_id
    inner join answers on questions.id = answers.question_id
    inner join participants on answers.participant_id = participants.id and games.id = participants.game_id
    left join choices on answers.choice_id = choices.id
    group by games.id, participants.id;
