'use client'

export const runtime = 'edge'

import {
  Answer,
  Choice,
  Game,
  Participant,
  Question,
  QuizSet,
  supabase,
} from '@/types/types'
import { ONLINE_THRESHOLD_MS } from '@/constants'
import { useEffect, useState } from 'react'
import Lobby from './lobby'
import Quiz from './quiz'
import Results from './results'

enum AdminScreens {
  lobby = 'lobby',
  quiz = 'quiz',
  result = 'result',
}

export default function Home({
  params: { id: gameId },
  searchParams,
}: {
  params: { id: string }
  searchParams: { view?: string }
}) {
  // ?view=results forces the results screen regardless of the live game phase,
  // so the host can open the leaderboard for a game still in progress (or one
  // that was stopped mid-quiz) from the past-games list. Read-only: the Results
  // component never changes the game phase.
  const forceResults = searchParams?.view === 'results'

  const [currentScreen, setCurrentScreen] = useState<AdminScreens>(
    AdminScreens.lobby
  )

  const [participants, setParticipants] = useState<Participant[]>([])

  const [quizSet, setQuizSet] = useState<QuizSet>()

  // Derived from participants[].last_seen (kept fresh by each player's
  // heartbeat, see HEARTBEAT_INTERVAL_MS) rather than Supabase Presence,
  // which doesn't work on this project's current supabase-js version (see
  // the participants_last_seen migration). Recomputed on a tick since
  // "online" is a function of the current time, not just of new data.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(interval)
  }, [])

  const presentIds = new Set(
    now === null
      ? []
      : participants
          .filter(
            (p) =>
              p.last_seen && now - new Date(p.last_seen).getTime() < ONLINE_THRESHOLD_MS
          )
          .map((p) => p.id)
  )

  useEffect(() => {
    const getQuestions = async () => {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('id', gameId)
        .single()
      if (gameError) {
        console.error(gameError.message)
        alert('Error getting game data')
        return
      }
      const { data, error } = await supabase
        .from('quiz_sets')
        .select(`*, questions(*, choices(*))`)
        .eq('id', gameData.quiz_set_id)
        .order('order', {
          ascending: true,
          referencedTable: 'questions',
        })
        .single()
      if (error) {
        console.error(error.message)
        getQuestions()
        return
      }
      setQuizSet(data)
    }

    const setGameListner = async () => {
      const { data } = await supabase
        .from('participants')
        .select()
        .eq('game_id', gameId)
        .order('created_at')
      if (data) setParticipants(data)

      supabase
        .channel('game')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'participants',
            filter: `game_id=eq.${gameId}`,
          },
          (payload) => {
            setParticipants((currentParticipants) => {
              return [...currentParticipants, payload.new as Participant]
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'participants',
            filter: `game_id=eq.${gameId}`,
          },
          (payload) => {
            const updated = payload.new as Participant
            setParticipants((currentParticipants) =>
              currentParticipants.map((p) => (p.id === updated.id ? updated : p))
            )
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`,
          },
          (payload) => {
            // start the quiz game
            const game = payload.new as Game
            setCurrentQuestionSequence(game.current_question_sequence)
            setCurrentScreen(game.phase as AdminScreens)
          }
        )
        .subscribe()

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('id', gameId)
        .single()

      if (gameError) {
        alert(gameError.message)
        console.error(gameError)
        return
      }

      setCurrentQuestionSequence(gameData.current_question_sequence)
      setCurrentScreen(gameData.phase as AdminScreens)
    }

    getQuestions()
    setGameListner()
  }, [gameId])

  const [currentQuestionSequence, setCurrentQuestionSequence] = useState(0)

  return (
    <main className="bg-green-600 min-h-screen">
      {!forceResults && currentScreen == AdminScreens.lobby && (
        <Lobby participants={participants} gameId={gameId}></Lobby>
      )}
      {!forceResults && currentScreen == AdminScreens.quiz && quizSet && (
        <Quiz
          question={quizSet.questions[currentQuestionSequence]}
          questionCount={quizSet.questions.length}
          gameId={gameId}
          participants={participants}
          presentIds={presentIds}
        ></Quiz>
      )}
      {(forceResults || currentScreen == AdminScreens.result) && quizSet && (
        <Results
          participants={participants}
          quizSet={quizSet}
          gameId={gameId}
          presentIds={presentIds}
        ></Results>
      )}
    </main>
  )
}
