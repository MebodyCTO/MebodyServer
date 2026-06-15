import { useCallback, useState } from 'react'
import { SampleQuestionnaire } from './components/SampleQuestionnaire'
import { SampleCompleteScreen } from './components/SampleCompleteScreen'
import { FadeSlidePanel } from './components/FadeSlidePanel'
import type { SampleCompletionPayload } from './types/sampleCompletion'

type Screen = 'questionnaire' | 'complete'

export default function App() {
  const [screen, setScreen] = useState<Screen>('questionnaire')
  const [completedResult, setCompletedResult] = useState<SampleCompletionPayload | null>(null)
  const [questionnaireKey, setQuestionnaireKey] = useState(0)

  const handleComplete = useCallback((result: SampleCompletionPayload) => {
    setCompletedResult(result)
    setScreen('complete')
  }, [])

  const handleRestart = useCallback(() => {
    setCompletedResult(null)
    setQuestionnaireKey((key) => key + 1)
    setScreen('questionnaire')
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <FadeSlidePanel key={screen}>
          {screen === 'questionnaire' ? (
            <SampleQuestionnaire key={questionnaireKey} onComplete={handleComplete} />
          ) : completedResult ? (
            <SampleCompleteScreen result={completedResult} onRestart={handleRestart} />
          ) : null}
        </FadeSlidePanel>
      </div>
    </div>
  )
}
