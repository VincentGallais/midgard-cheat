import { ArgineInterface, QueryTypes } from 'midgard-commons/lib/argine-interface.js'
import * as bridge from 'midgard-commons/lib/bridge.js'
import fs from 'fs/promises'
import { match } from 'assert'

// TODO : utiliser le bon scoring type dans les appels à Argine
const argineInterface = new ArgineInterface()

function formatToArgine(input) {
  return input
    .split('-')
    .map((part) => part.slice(0, 2))
    .join('')
}

function getPlayerCards(distribution, player) {
  const playerCards = []
  for (let i = 0; i < distribution.length; i++) {
    if (distribution[i] === player) {
      playerCards.push(bridge.CARDS[i])
    }
  }
  return playerCards.reverse()
}

function getMaskForPlayer(player) {
  switch (player) {
    case bridge.PLAYER_SOUTH:
      return 1
    case bridge.PLAYER_WEST:
      return 2
    case bridge.PLAYER_NORTH:
      return 4
    case bridge.PLAYER_EAST:
      return 8
    default:
      return 0
  }
}

async function getCard(query) {
  const { data } = await argineInterface.callArgine(query, QueryTypes.Card)
  return data.value.slice(0, 2)
}

async function getEval(query, player = bridge.PLAYER_SOUTH) {
  const { data } = await argineInterface.callArgine({ ...query, maskHand: getMaskForPlayer(player) }, QueryTypes.Eval)
  return data.value.split(';')
}

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
          bids: formatToArgine(game.ST_bids)
        },
        conventions: { NS: bridge.defaultConventions, EW: bridge.defaultConventions },
        options: bridge.defaultOptions
      }

      try {
        const argineLead = await getCard(query)
        const playerLead = game.ST_cards.slice(0, 2)

        const leadEval = (await getEval(query)).slice(0, 13)

        const playerCards = getPlayerCards(game.ST_distribution, bridge.PLAYER_SOUTH)

        const argineLeadCardIndex = playerCards.indexOf(argineLead)
        const playerLeadCardIndex = playerCards.indexOf(playerLead)

        const argineLeadEval = leadEval[argineLeadCardIndex]
        const playerLeadEval = leadEval[playerLeadCardIndex]

        // Je regarde si l'entame est populaire (pour les joueurs au même atout et les joueurs au même contrat)
        // Je regarde le résultat de la donne

        const delta = playerLeadEval - argineLeadEval
        if (delta > 0) {
          console.log(`Joueur ${delta}, ${game.FT_final_score_deal}`)
        } else if (delta < 0) {
          console.log(`Argine ${-delta}, ${game.FT_final_score_deal}`)
        } else {
          console.log(`Identique`)
        }
      } catch (e) {
        console.error(`Erreur pour la game ${game.ID_game}:`, e)
      }
    }
  }
}

function divideChunks(arr, chunkSize) {
  const result = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize))
  }
  return result
}

function getPlayerHcp(cards) {
  const hcp = {
    A: 4,
    K: 3,
    Q: 2,
    J: 1
  }
  return cards.reduce((total, card) => {
    const rank = card[0]
    return total + (hcp[rank] || 0)
  }, 0)
}

function getPlayerCardsBySuits(cards) {
  const suits = {
    C: 0,
    D: 0,
    H: 0,
    S: 0
  }
  for (const card of cards) {
    const suit = card[1]
    suits[suit] += 1
  }
  return suits
}

async function scanBids() {
  const raw = await fs.readFile('src/data/mockData.json', 'utf-8')
  const games = JSON.parse(raw)

  // Je veux tester toutes les enchères de Sud par rapport à la reglette
  for (const game of games) {
    const bidding = divideChunks(formatToArgine(game.ST_bids), 2)

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

        const { data } = await argineInterface.callArgine(query, QueryTypes.BidInfo)

        const [minC, maxC, minD, maxD, minH, maxH, minS, maxS, minPts, maxPts] = data.value.split(';').map(Number)

        const playerCards = getPlayerCards(game.ST_distribution, bridge.PLAYER_SOUTH)

        const playerHcp = getPlayerHcp(playerCards)
        const playerCardsBySuits = getPlayerCardsBySuits(playerCards)

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
            `Différences pour Sud: ${playerDifferences.join(', ')}, Enchère: ${bid}, Séquence : ${bidding.slice(0, idx + 1).join('')}, Score: ${game.FT_final_score_deal}`
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
      cards: formatToArgine(game.ST_cards),
      bids: formatToArgine(game.ST_bids)
    },
    conventions: { NS: bridge.defaultConventions, EW: bridge.defaultConventions },
    options: bridge.defaultOptions
  }

  const cardEvals = await getEval(query, ciblePlayer)
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
    const cardWithPlayer = cardList[cardIdx]
    const cardValue = cardWithPlayer.slice(0, 2)
    const cardPlayer = cardWithPlayer[2]

    // On arrête d'analyser après un claim
    if (cardValue.slice(0, 1) === '!') {
      break
    }

    if (cardPlayer === ciblePlayer) {
      const cardsPlayedSoFar = formatToArgine(game.ST_cards.slice(0, cardIdx * 4))

      try {
        // Demander à Argine quelle carte elle aurait joué
        const argineCard = await getCard({ ...query, game: { ...query.game, cards: cardsPlayedSoFar } })

        // Obtenir les cartes du joueur courant
        const playerCards = getPlayerCards(game.ST_distribution, ciblePlayer)

        // Trouver les index des cartes
        const argineCardIndex = playerCards.indexOf(argineCard)
        const playerCardIndex = playerCards.indexOf(cardValue)

        const trickIdx = Math.floor(cardIdx / 4)
        const trickSeat = Math.floor(cardIdx % 4)
        const trickEval = evalChunks[trickIdx][trickSeat]

        const argineEval = parseFloat(trickEval[argineCardIndex])
        const playerEval = parseFloat(trickEval[playerCardIndex])

        const delta = playerEval - argineEval
        if (delta > 0) {
          console.log(`${ciblePlayer} - Carte ${cardIdx + 1}: Joueur: ${cardValue} (${playerEval}), Argine: ${argineCard} (${argineEval}), écart de ${delta}`)
        } else if (delta < 0) {
          console.log(`${ciblePlayer} - Carte ${cardIdx + 1}: Joueur: ${cardValue} (${playerEval}), Argine: ${argineCard} (${argineEval}), écart de ${delta}`)
        }
      } catch (e) {
        console.error(`Erreur lors de l'analyse de la carte ${ciblePlayer} ${cardIdx + 1} pour la game ${game.ID_game}:`, e)
      }
    }
  }
}

export { scanLead, scanBids, scanCards }
