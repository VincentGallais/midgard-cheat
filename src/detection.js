import * as bridge from 'midgard-commons/lib/bridge.js'
import * as utils from './utils.js'
import fs from 'fs/promises'

async function scanLead() {
  const raw = await fs.readFile('src/data/mockData.json', 'utf-8')
  const games = JSON.parse(raw)

  for (const game of games) {
    if (game.CD_declarer === 'E') {
      const query = {
        deal: {
          dealer: game.CD_dealer,
          vulnerability: game.CD_vulnerability,
          distribution: game.ST_distribution
        },
        game: {
          cards: '',
          bids: utils.formatToArgine(game.ST_bids)
        },
        conventions: { NS: bridge.defaultConventions, EW: bridge.defaultConventions },
        options: bridge.defaultOptions
      }

      try {
        const argineLead = await utils.getCard(query)
        const playerLead = game.ST_cards.slice(0, 2)

        const leadEval = (await utils.getEval(query)).slice(0, 13)

        const playerCards = utils.getPlayerCards(game.ST_distribution, bridge.PLAYER_SOUTH)

        // Trouver l'index des cartes jouées
        const argineLeadCardIndex = playerCards.indexOf(argineLead)
        const playerLeadCardIndex = playerCards.indexOf(playerLead)

        const argineLeadEval = leadEval[argineLeadCardIndex]
        const playerLeadEval = leadEval[playerLeadCardIndex]

        // Je regarde si l'entame est populaire (pour les joueurs au même atout et les joueurs au même contrat)
        // Je regarde le résultat de la donne

        const delta = playerLeadEval - argineLeadEval
        if (delta > 0) {
          console.log(`Player ${delta}, ${game.FT_final_score_deal}`)
        } else if (delta < 0) {
          console.log(`Argine ${-delta}, ${game.FT_final_score_deal}`)
        } else {
          console.log(`Identical`)
        }
      } catch (e) {
        console.error(`Error for game ${game.ID_game}:`, e)
      }
    }
  }
}

async function scanBids() {
  const raw = await fs.readFile('src/data/mockData.json', 'utf-8')
  const games = JSON.parse(raw)

  // Je veux tester toutes les enchères de Sud par rapport à la reglette
  for (const game of games) {
    const bidding = utils.divideChunks(utils.formatToArgine(game.ST_bids), 2)

    // Trouver l'index du joueur dans bridge.PLAYERS en considérant que game.CD_dealer est le premier
    const dealerIdx = bridge.PLAYERS.indexOf(game.CD_dealer)
    const southIdx = (bridge.PLAYERS.indexOf(bridge.PLAYER_SOUTH) - dealerIdx + bridge.PLAYERS.length) % bridge.PLAYERS.length

    for (let idx = 0; idx < bidding.length; idx++) {
      const bid = bidding[idx]
      if (idx % 4 === southIdx) {
        const query = {
          deal: {
            dealer: game.CD_dealer,
            vulnerability: game.CD_vulnerability,
            distribution: game.ST_distribution
          },
          game: {
            cards: '',
            bids: bidding.slice(0, idx + 1).join('')
          },
          conventions: { NS: bridge.defaultConventions, EW: bridge.defaultConventions },
          options: bridge.defaultOptions
        }

        const bidInfo = await utils.getBidInfo(query)
        const [minC, maxC, minD, maxD, minH, maxH, minS, maxS, minPts, maxPts] = bidInfo

        const playerCards = utils.getPlayerCards(game.ST_distribution, bridge.PLAYER_SOUTH)

        const playerHcp = utils.getPlayerHcp(playerCards)
        const playerCardsBySuits = utils.utils.getPlayerCardsBySuits(playerCards)

        const TOLERANCE_HCP = 2
        const TOLERANCE_CARD = 1

        const playerDifferences = []
        if (minC > playerCardsBySuits.C + TOLERANCE_CARD || maxC < playerCardsBySuits.C - TOLERANCE_CARD) {
          playerDifferences.push(`C: ${minC} < ${playerCardsBySuits.C} < ${maxC}`)
        }
        if (minD > playerCardsBySuits.D + TOLERANCE_CARD || maxD < playerCardsBySuits.D - TOLERANCE_CARD) {
          playerDifferences.push(`D: ${minD} < ${playerCardsBySuits.D} < ${maxD}`)
        }
        if (minH > playerCardsBySuits.H + TOLERANCE_CARD || maxH < playerCardsBySuits.H - TOLERANCE_CARD) {
          playerDifferences.push(`H: ${minH} < ${playerCardsBySuits.H} < ${maxH}`)
        }
        if (minS > playerCardsBySuits.S + TOLERANCE_CARD || maxS < playerCardsBySuits.S - TOLERANCE_CARD) {
          playerDifferences.push(`S: ${minS} < ${playerCardsBySuits.S} < ${maxS}`)
        }
        if (minPts > playerHcp + TOLERANCE_HCP || maxPts < playerHcp - TOLERANCE_HCP) {
          playerDifferences.push(`Pts: ${minPts} < ${playerHcp} < ${maxPts}`)
        }

        if (playerDifferences.length !== 0) {
          console.log(
            `Differences for South: ${playerDifferences.join(', ')}, Bid: ${bid}, Sequence: ${bidding.slice(0, idx + 1).join('')}, Score: ${game.FT_final_score_deal}`
          )
        }
      }
    }
  }
}

async function scanCards() {
  const raw = await fs.readFile('src/data/mockData.json', 'utf-8')
  const games = JSON.parse(raw)

  for (const game of games) {
    const declarer = game.CD_declarer

    // Analyser les cartes jouées par Sud
    await analyzeCards(game, bridge.PLAYER_SOUTH)

    // Si Sud ou Nord est déclarant, analyser aussi les cartes de Nord
    if (declarer === bridge.PLAYER_SOUTH || declarer === bridge.PLAYER_NORTH) {
      await analyzeCards(game, bridge.PLAYER_NORTH)
    }
  }
}

async function analyzeCards(game, ciblePlayer) {
  const query = {
    deal: {
      dealer: game.CD_dealer,
      vulnerability: game.CD_vulnerability,
      distribution: game.ST_distribution
    },
    game: {
      cards: utils.formatToArgine(game.ST_cards),
      bids: utils.formatToArgine(game.ST_bids)
    },
    conventions: { NS: bridge.defaultConventions, EW: bridge.defaultConventions },
    options: bridge.defaultOptions
  }

  // Obtenir les cartes du joueur courant
  const playerCards = utils.getPlayerCards(game.ST_distribution, ciblePlayer)

  const cardEvals = await utils.getEval(query, ciblePlayer)
  const evalChunks = []

  for (let i = 0; i < cardEvals.length; i += 52) {
    const trick = cardEvals.slice(i, i + 52)
    const trickChunks = []
    for (let j = 0; j < trick.length; j += 13) {
      trickChunks.push(trick.slice(j, j + 13))
    }
    evalChunks.push(trickChunks)
  }

  const cardList = game.ST_cards.split('-')

  // On n'analyse ni l'entame (index 1) ni les 4 dernières cartes
  for (let cardIdx = 1; cardIdx < Math.min(cardList.length, 48); cardIdx++) {
    const cardValue = cardList[cardIdx].slice(0, 2)
    const cardPlayer = cardList[cardIdx][2]

    // On arrête d'analyser après un claim
    if (cardValue.slice(0, 1) === '!') {
      break
    }

    if (cardPlayer === ciblePlayer) {
      const cardsPlayedSoFar = utils.formatToArgine(game.ST_cards.slice(0, cardIdx * 4))

      try {
        // Demander à Argine quelle carte elle aurait joué
        const argineCard = await utils.getCard({ ...query, game: { ...query.game, cards: cardsPlayedSoFar } })

        // Trouver l'index des cartes jouées
        const argineCardIndex = playerCards.indexOf(argineCard)
        const playerCardIndex = playerCards.indexOf(cardValue)

        const trickIdx = Math.floor(cardIdx / 4)
        const trickSeat = Math.floor(cardIdx % 4)
        const trickEval = evalChunks[trickIdx][trickSeat]

        const argineEval = parseFloat(trickEval[argineCardIndex])
        const playerEval = parseFloat(trickEval[playerCardIndex])

        const delta = playerEval - argineEval
        if (delta > 0) {
          console.log(
            `Game ${game.ID_game}, ${ciblePlayer} - Card ${cardIdx + 1}: Player: ${cardValue} (${playerEval}), Argine: ${argineCard} (${argineEval}), delta ${delta}`
          )
        } else if (delta < 0) {
          console.log(
            `Game ${game.ID_game}, ${ciblePlayer} - Card ${cardIdx + 1}: Player: ${cardValue} (${playerEval}), Argine: ${argineCard} (${argineEval}), delta ${delta}`
          )
        }
      } catch (e) {
        console.error(`Error while analyzing card ${ciblePlayer} ${cardIdx + 1} for game ${game.ID_game}:`, e)
      }
    }
  }
}

export { scanLead, scanBids, scanCards }
