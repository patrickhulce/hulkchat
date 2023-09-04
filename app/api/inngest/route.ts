import { inngest } from '@/lib/inngest'
import { serve } from 'inngest/next'

import * as functions from '@/lib/inngest/functions'

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve(inngest, [
  functions.startTaskEvaluation,
  functions.getModelResponseForTask,
  functions.evaluateTaskModel
])
