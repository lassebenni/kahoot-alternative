-- Add correct_count to game_results so ranking can tiebreak: a player who
-- answered more questions correctly always outranks one with fewer correct
-- answers, regardless of speed-bonus points. Without this, a fast 9/10 could
-- beat a slower 10/10 — confusing for players.
create or replace view game_results as
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
