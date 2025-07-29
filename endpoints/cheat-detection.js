import pino from 'pino'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'
import * as quizGenerator from '../src/quizGenerator.js'
import { GCSService } from '../src/gcsService.js'

export class CheatDetection {
  constructor(fastifyInstance) {
    this.logger = pino({
      level: 'info'
    })
    this.dbClient = new PostgresClient(fastifyInstance)
    this.gcsService = GCSService.create(fastifyInstance, '52-entertainment-goto-funbridge-quizz')
  }

  async handleQuizError(reply, error, quizType) {
    this.logger.error(`Error while generating ${quizType} quiz`, error)

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: `An error occurred while generating the ${quizType} quiz.`
    })
  }

  registerEndpoints(fastifyInstance) {
    fastifyInstance.post('/api/quiz/whichHand', async (request, reply) => {
      try {
        const result = await quizGenerator.whichHandQuiz()

        return reply.status(200).send({
          success: true,
          data: result
        })
      } catch (error) {
        return this.handleQuizError(reply, error, 'Which Hand')
      }
    })

    fastifyInstance.post('/api/quiz/distribution', async (request, reply) => {
      try {
        const result = await quizGenerator.distributionQuiz()

        return reply.status(200).send({
          success: true,
          data: result
        })
      } catch (error) {
        return this.handleQuizError(reply, error, 'Distribution')
      }
    })

    fastifyInstance.post('/api/quiz/bidMeaning', async (request, reply) => {
      try {
        const result = await quizGenerator.bidMeaningQuiz()

        return reply.status(200).send({
          success: true,
          data: result
        })
      } catch (error) {
        return this.handleQuizError(reply, error, 'Bid Meaning')
      }
    })

    fastifyInstance.post('/api/quiz/bidQuiz', async (request, reply) => {
      try {
        const gcsClient = this.gcsService.getClient()
        const result = await quizGenerator.bidQuiz(gcsClient)

        return reply.status(200).send({
          success: true,
          data: result,
          count: result.length
        })
      } catch (error) {
        return this.handleQuizError(reply, error, 'Bid')
      }
    })

    fastifyInstance.post('/api/quiz/leadQuiz', async (request, reply) => {
      try {
        const gcsClient = this.gcsService.getClient()
        const result = await quizGenerator.leadQuiz(gcsClient)

        return reply.status(200).send({
          success: true,
          data: result,
          count: result.length
        })
      } catch (error) {
        return this.handleQuizError(reply, error, 'Lead')
      }
    })
  }
}
