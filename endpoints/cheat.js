import pino from 'pino'
import { PostgresClient } from 'midgard-commons/lib/postgres-client.js'
import * as detection from '../src/detection.js'
import { GCSService } from '../src/gcsService.js'

export class CheatDetection {
  constructor(fastifyInstance) {
    this.logger = pino({
      level: 'info'
    })
    this.dbClient = new PostgresClient(fastifyInstance)
    // this.gcsService = GCSService.create(fastifyInstance, '52-entertainment-goto-funbridge-cheat-detection')
  }

  async handleError(reply, error, type) {
    console.log(error)
    this.logger.error(`Error while scanning user ${type}`, error)

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: `An error occurred while scanning ${type}.`
    })
  }

  registerEndpoints(fastifyInstance) {
    fastifyInstance.post('/api/cheat-detection/scan-lead', async (request, reply) => {
      try {
        const result = await detection.scanLead()

        return reply.status(200).send({
          success: true,
          data: result
        })
      } catch (error) {
        return this.handleError(reply, error, 'Lead')
      }
    })

    fastifyInstance.post('/api/cheat-detection/scan-bidding', async (request, reply) => {
      try {
        const result = await detection.scanBids()

        return reply.status(200).send({
          success: true,
          data: result
        })
      } catch (error) {
        return this.handleError(reply, error, 'Bidding')
      }
    })

    fastifyInstance.post('/api/cheat-detection/scan-carding', async (request, reply) => {
      try {
        const result = await detection.scanCards()

        return reply.status(200).send({
          success: true,
          data: result
        })
      } catch (error) {
        return this.handleError(reply, error, 'Bidding')
      }
    })
  }
}
