import { CommonsServer } from 'midgard-commons/lib/common-server.js'
import { CheatDetection } from './endpoints/cheat.js'

const server = new CommonsServer()

await server.initialize()
await server.registerDefaultEndpoints('/midgard-cheat-detection')
await server.setDefaultErrorHandler()

const cheatDetection = new CheatDetection(server.fastifyInstance)

await server.fastifyInstance.register(
  (fastifyInstance, opts, next) => {
    cheatDetection.registerEndpoints(fastifyInstance)
    next()
  },
  { prefix: '/midgard-cheat-detection' }
)

await server.startServer()
