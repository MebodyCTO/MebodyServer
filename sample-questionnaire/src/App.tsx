import { useState } from 'react'
import { SampleQuestionnaire } from './components/SampleQuestionnaire'
import { SampleCompleteScreen } from './components/SampleCompleteScreen'
import { FadeSlidePanel } from './components/FadeSlidePanel'

type Screen = 'questionnaire' | 'complete'

export default function App() {
  const [screen, setScreen] = useState<Screen>('questionnaire')

  const handleComplete = (_code: string) => {
    setScreen('complete')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <FadeSlidePanel key={screen}>
          {screen === 'questionnaire' ? (
            <SampleQuestionnaire onComplete={handleComplete} />
          ) : (
            <SampleCompleteScreen />
          )}
        </FadeSlidePanel>
      </div>
    </div>
  )
}
