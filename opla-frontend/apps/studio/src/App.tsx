import { useState } from 'react'
import { OplaButton, OplaCard } from '@opla/ui'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary mb-4">
            Project Opla
          </h1>
          <p className="text-muted-foreground text-lg">
            Studio Environment
          </p>
        </div>

        <OplaCard title="Shared Component Demo">
          <div className="space-y-4">
            <p className="text-foreground">
              This card and button are shared from <code>packages/ui</code>.
            </p>
            <div className="flex justify-center">
              <OplaButton
                title={`Count is ${count}`}
                onPress={() => setCount((count) => count + 1)}
              />
            </div>
          </div>
        </OplaCard>
      </div>
    </div>
  )
}

export default App
