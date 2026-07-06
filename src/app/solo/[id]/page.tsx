'use client'

export const runtime = 'edge'

import { Choice, Question, QuizSet, supabase } from '@/types/types'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CountdownCircleTimer } from 'react-countdown-circle-timer'

const TIME_TIL_CHOICE_REVEAL = 5000
const QUESTION_ANSWER_TIME = 30000

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type UserAnswer = {
  questionId: string
  choiceId: string | null
  correct: boolean
  score: number
}

type InspectTarget = {
  question: Question
  chosen: Choice | null
  correct: Choice | null
}

export default function SoloQuiz({ params }: { params: { id: string } }) {
  const [quizSet, setQuizSet] = useState<QuizSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<'lobby' | 'quiz' | 'result'>('lobby')
  const [currentIdx, setCurrentIdx] = useState(0)

  const [hasShownChoices, setHasShownChoices] = useState(false)
  const [chosenChoice, setChosenChoice] = useState<Choice | null>(null)
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState(0)

  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([])

  const [inspect, setInspect] = useState<InspectTarget | null>(null)

  useEffect(() => {
    const fetchQuiz = async () => {
      const { data, error } = await supabase
        .from('quiz_sets')
        .select(`*, questions(*, choices(*))`)
        .eq('id', params.id)
        .order('order', { referencedTable: 'questions', ascending: true })
        .order('id', { referencedTable: 'questions.choices', ascending: true })
        .single()
      if (error || !data) {
        setError(error?.message ?? 'Quiz not found')
        setLoading(false)
        return
      }
      setQuizSet(data as QuizSet)
      setLoading(false)
    }
    fetchQuiz()
  }, [params.id])

  const currentQuestion = quizSet?.questions[currentIdx]

  // Shuffle choices for the current question so they aren't in database order
  const shuffledChoices = useMemo(() => {
    if (!currentQuestion) return []
    return shuffled(currentQuestion.choices)
  }, [currentQuestion?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white/70 flex justify-center items-center font-medium">
        <p className="animate-pulse">Loading quiz...</p>
      </div>
    )
  }

  if (error || !quizSet) {
    return (
      <div className="min-h-screen bg-slate-900 text-red-400 flex flex-col justify-center items-center p-6 text-center">
        <p className="text-xl font-bold mb-4">Could not load quiz</p>
        <p className="text-sm opacity-80 mb-6">{error || 'Quiz set not found.'}</p>
        <Link
          href="/"
          className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg text-sm transition"
        >
          Go Back
        </Link>
      </div>
    )
  }

  const totalQuestions = quizSet.questions.length

  const startQuiz = () => {
    setPhase('quiz')
    setCurrentIdx(0)
    setScore(0)
    setCorrectCount(0)
    setUserAnswers([])
    setChosenChoice(null)
    setHasShownChoices(false)
    setIsAnswerRevealed(false)
  }

  const answerQuestion = (choice: Choice | null) => {
    if (isAnswerRevealed) return
    setChosenChoice(choice)
    setIsAnswerRevealed(true)

    const isCorrect = choice?.is_correct ?? false
    let gainedScore = 0

    if (isCorrect && choice) {
      const duration = Date.now() - questionStartTime
      gainedScore = 1000 - Math.round(
        Math.max(0, Math.min(duration / QUESTION_ANSWER_TIME, 1)) * 1000
      )
      setScore((s) => s + gainedScore)
      setCorrectCount((c) => c + 1)
    }

    setUserAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion!.id,
        choiceId: choice?.id ?? null,
        correct: isCorrect,
        score: gainedScore,
      },
    ])
  }

  const handleTimeUp = () => {
    if (isAnswerRevealed) return
    answerQuestion(null)
  }

  const handleNext = () => {
    if (currentIdx === totalQuestions - 1) {
      setPhase('result')
    } else {
      setCurrentIdx((idx) => idx + 1)
      setChosenChoice(null)
      setHasShownChoices(false)
      setIsAnswerRevealed(false)
    }
  }

  const openInspect = (q: Question) => {
    const ua = userAnswers.find((a) => a.questionId === q.id)
    const chosen = ua?.choiceId ? (q.choices.find((c) => c.id === ua.choiceId) ?? null) : null
    const correct = q.choices.find((c) => c.is_correct) ?? null
    setInspect({ question: q, chosen, correct })
  }

  return (
    <main className="bg-slate-900 min-h-screen text-white flex flex-col items-stretch">
      {/* LOBBY PHASE */}
      {phase === 'lobby' && (
        <div className="flex-grow flex flex-col justify-center items-center p-6 text-center max-w-xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight">{quizSet.name}</h1>
          {quizSet.description && (
            <p className="text-white/60 text-lg mb-8 leading-relaxed">{quizSet.description}</p>
          )}
          <div className="bg-slate-800 rounded-2xl p-8 border border-white/10 w-full shadow-2xl flex flex-col items-center">
            <span className="text-5xl mb-4">🎮</span>
            <h2 className="text-xl font-bold mb-2">Single Player Mode</h2>
            <p className="text-white/50 text-sm mb-6 max-w-xs">
              Answer the questions yourself within the 30-second time limit per question.
            </p>
            <button
              onClick={startQuiz}
              className="w-full bg-green-600 hover:bg-green-500 font-bold py-4 rounded-xl text-lg shadow-lg hover:shadow-green-500/20 active:scale-95 transition"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* QUIZ PHASE */}
      {phase === 'quiz' && currentQuestion && (
        <div className="flex-grow flex flex-col items-stretch relative">
          {/* Header Progress and Next Button */}
          <div className="flex justify-between items-center p-4 bg-slate-950/60 border-b border-white/5">
            <span className="text-sm font-semibold text-white/50">
              Question {currentIdx + 1} of {totalQuestions}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-green-400">{score} pts</span>
            </div>
          </div>

          {/* Question Text */}
          <div className="text-center px-4 mt-8">
            <h2 className="text-2xl bg-white text-slate-900 font-extrabold mx-auto max-w-3xl px-8 py-6 rounded-2xl shadow-2xl inline-block leading-tight">
              {currentQuestion.body}
            </h2>
          </div>

          {/* Countdown / Answer State */}
          <div className="flex-grow flex flex-col justify-center items-center py-6 px-4">
            {/* 1. Countdown Before Choices are Shown */}
            {!hasShownChoices && !isAnswerRevealed && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in">
                <CountdownCircleTimer
                  key={`pre-${currentQuestion.id}`}
                  onComplete={() => {
                    setHasShownChoices(true)
                    setQuestionStartTime(Date.now())
                  }}
                  isPlaying
                  duration={TIME_TIL_CHOICE_REVEAL / 1000}
                  colors={['#ffffff', '#ffffff', '#ffffff', '#ffffff']}
                  colorsTime={[5, 3, 1, 0]}
                  trailColor="rgba(255,255,255,0.05)"
                  size={120}
                  strokeWidth={8}
                >
                  {({ remainingTime }) => (
                    <span className="text-3xl font-extrabold">{remainingTime}</span>
                  )}
                </CountdownCircleTimer>
                <p className="text-white/40 text-sm font-medium tracking-wide uppercase">Get Ready...</p>
              </div>
            )}

            {/* 2. Real-time Choice Buttons Grid */}
            {hasShownChoices && !isAnswerRevealed && (
              <div className="w-full max-w-4xl flex flex-col items-stretch gap-6 flex-grow justify-center">
                {/* 30 Sec countdown timer */}
                <div className="flex justify-center mb-4">
                  <CountdownCircleTimer
                    key={`ans-${currentQuestion.id}`}
                    onComplete={handleTimeUp}
                    isPlaying
                    duration={QUESTION_ANSWER_TIME / 1000}
                    colors={['#22c55e', '#eab308', '#ef4444', '#ef4444']}
                    colorsTime={[20, 10, 5, 0]}
                    size={80}
                    strokeWidth={6}
                    trailColor="#374151"
                  >
                    {({ remainingTime }) => (
                      <span className="text-2xl font-bold">{remainingTime}</span>
                    )}
                  </CountdownCircleTimer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shuffledChoices.map((choice, index) => (
                    <button
                      key={choice.id}
                      onClick={() => answerQuestion(choice)}
                      className={`px-6 py-8 text-xl font-bold rounded-2xl flex justify-between items-center transition shadow-lg active:scale-[0.98]
                        ${
                          index === 0
                            ? 'bg-red-500 hover:bg-red-400'
                            : index === 1
                            ? 'bg-blue-500 hover:bg-blue-400'
                            : index === 2
                            ? 'bg-yellow-600 hover:bg-yellow-500'
                            : 'bg-green-600 hover:bg-green-500'
                        }
                      `}
                    >
                      <span>{choice.body}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Feedback Reveal Screen */}
            {isAnswerRevealed && (
              <div className="flex flex-col items-center text-center animate-in zoom-in duration-300 max-w-xl mx-auto w-full">
                <div
                  className={`rounded-full p-4 mb-4 ${
                    chosenChoice?.is_correct ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  {chosenChoice?.is_correct ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={5}
                      stroke="currentColor"
                      className="w-12 h-12"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={5}
                      stroke="currentColor"
                      className="w-12 h-12"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>

                <h3 className="text-3xl font-extrabold mb-4">
                  {chosenChoice === null
                    ? "Time's Up!"
                    : chosenChoice.is_correct
                    ? 'Correct!'
                    : 'Incorrect!'}
                </h3>

                {/* Explanation Card */}
                {currentQuestion.explanation && (
                  <div className="p-5 rounded-2xl bg-slate-800 border border-blue-900/60 text-left w-full mb-6">
                    <span className="font-bold text-blue-400 block text-xs tracking-wider uppercase mb-1">
                      Why it is correct:
                    </span>
                    <span className="text-white/80 leading-relaxed text-sm">
                      {currentQuestion.explanation}
                    </span>
                  </div>
                )}

                {/* Question choices display with correct checkmarks */}
                <div className="w-full grid grid-cols-1 gap-2 mt-2">
                  {shuffledChoices.map((choice, index) => {
                    const isChosen = chosenChoice?.id === choice.id
                    const isCorrect = choice.is_correct
                    return (
                      <div
                        key={choice.id}
                        className={`px-4 py-3 rounded-xl flex justify-between items-center text-sm font-medium border
                          ${
                            isCorrect
                              ? 'bg-green-950/20 border-green-500/50 text-green-200'
                              : isChosen
                              ? 'bg-red-950/20 border-red-500/50 text-red-200'
                              : 'bg-slate-800/40 border-white/5 text-white/50'
                          }
                        `}
                      >
                        <span>{choice.body}</span>
                        <span>
                          {isCorrect && '✓ correct'}
                          {isChosen && !isCorrect && '✗ your answer'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Next / Finish below the answers, not in the header */}
                <button
                  onClick={handleNext}
                  className="mt-8 w-full bg-white text-black font-bold py-4 rounded-xl text-lg hover:bg-gray-200 active:scale-95 transition"
                >
                  {currentIdx === totalQuestions - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="flex bg-slate-950 py-3 px-4 justify-between items-center text-white/40 text-xs">
            <span>Solo Play Mode</span>
            <span>{currentIdx + 1} / {totalQuestions}</span>
          </div>
        </div>
      )}

      {/* RESULTS PHASE */}
      {phase === 'result' && (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center px-4 py-16 gap-8 max-w-2xl mx-auto w-full animate-in fade-in duration-500">
          <div className="bg-slate-900 rounded-3xl p-8 border border-white/10 shadow-2xl flex flex-col items-center text-center w-full">
            <span className="text-6xl mb-4">🏆</span>
            <p className="text-white/50 text-sm mb-1 uppercase tracking-wider">Quiz Completed!</p>
            <span className="text-4xl font-extrabold text-white mb-2">{score}</span>
            <span className="text-lg font-semibold text-white/70">
              {correctCount} <span className="text-white/40">/ {totalQuestions} correct</span>
            </span>

            <button
              onClick={startQuiz}
              className="mt-8 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl text-md transition active:scale-95"
            >
              Play Again
            </button>
          </div>

          {/* Grid of Results */}
          <div className="w-full bg-slate-900 rounded-2xl p-6 border border-white/5 shadow-xl">
            <h3 className="text-white font-bold text-lg mb-1">Your Answers Grid</h3>
            <p className="text-white/40 text-xs mb-4">Tap a cell to see the question and explanation.</p>
            <div className="flex flex-wrap gap-2.5">
              {quizSet.questions.map((q, i) => {
                const ua = userAnswers.find((a) => a.questionId === q.id)
                const isCorrect = ua?.correct ?? false
                const answered = ua?.choiceId !== null && ua !== undefined
                return (
                  <button
                    key={q.id}
                    onClick={() => openInspect(q)}
                    className={`w-11 h-11 rounded-lg text-sm font-extrabold flex items-center justify-center transition active:scale-90
                      ${
                        isCorrect
                          ? 'bg-green-600 text-white hover:bg-green-500'
                          : answered
                          ? 'bg-red-700 text-white hover:bg-red-600'
                          : 'bg-slate-700 text-white/50 hover:bg-slate-600'
                      }
                    `}
                    title={`Question ${i + 1}`}
                  >
                    {isCorrect ? '✓' : answered ? '✗' : '—'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Home Link */}
          <Link href="/" className="text-white/40 hover:text-white text-sm transition">
            ← Back to Home
          </Link>

          {/* Inspect Modal */}
          {inspect && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4 animate-in fade-in duration-200"
              onClick={() => setInspect(null)}
            >
              <div
                className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-white font-bold text-lg mb-4">{inspect.question.body}</p>
                <div className="flex flex-col gap-2 mb-5">
                  {inspect.question.choices.map((c) => {
                    const isChosen = c.id === inspect.chosen?.id
                    const isCorrect = c.is_correct
                    return (
                      <div
                        key={c.id}
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium flex justify-between
                          ${
                            isCorrect
                              ? 'bg-green-600 text-white'
                              : isChosen
                              ? 'bg-red-700 text-white'
                              : 'bg-slate-800 text-white/50'
                          }
                        `}
                      >
                        <span>{c.body}</span>
                        <span>
                          {isCorrect && '✓'}
                          {isChosen && !isCorrect && '✗'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {inspect.question.explanation && (
                  <div className="mb-5 p-3 rounded bg-blue-950/40 border border-blue-900/50 text-sm">
                    <span className="font-bold text-blue-400 block text-xs tracking-wider uppercase mb-1">
                      Why it is correct:
                    </span>
                    <span className="text-blue-100 text-xs leading-relaxed">
                      {inspect.question.explanation}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setInspect(null)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-sm transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
