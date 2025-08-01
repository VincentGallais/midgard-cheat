import { ArgineInterface, QueryTypes } from 'midgard-commons/lib/argine-interface.js'
import * as bridge from 'midgard-commons/lib/bridge.js'
import fs from 'fs/promises'

// TODO : utiliser le bon scoring type dans les appels à Argine
const argineInterface = new ArgineInterface()

function formatBid(bid) {
  return bid
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
  return playerCards
}

async function getLead(query) {
  const { data } = await argineInterface.callArgine(query, QueryTypes.Card)
  return data.value.slice(0, 2)
}

async function getEval(query) {
  const { data } = await argineInterface.callArgine(query, QueryTypes.Eval)
  return data.value.split(';').slice(0, 13)
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
          bids: formatBid(game.ST_bids)
        },
        conventions: { NS: bridge.defaultConventions, EW: bridge.defaultConventions },
        options: bridge.defaultOptions
      }

      try {
        const argineLead = await getLead(query)
        const playerLead = game.ST_cards.slice(0, 2)

        const leadEval = await getEval(query)

        const playerCards = getPlayerCards(game.ST_distribution, bridge.PLAYERS_SOUTH)

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
    const bidding = divideChunks(formatBid(game.ST_bids), 2)

    // Trouver l'index du joueur dans bridge.PLAYERS en considérant que game.CD_dealer est le premier
    const dealerIdx = bridge.PLAYERS.indexOf(game.CD_dealer)
    const southIdx = (bridge.PLAYERS.indexOf(bridge.PLAYERS_SOUTH) - dealerIdx + bridge.PLAYERS.length) % bridge.PLAYERS.length

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

        const playerCards = getPlayerCards(game.ST_distribution, bridge.PLAYERS_SOUTH)

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
  // Regarder les cartes de Sud et de Nord si le déclarant est dans le camp N/S
  // Voir la carte conseillée par Argine, voir si c'est inférieur à la carte jouée par le joueur
}

export { scanLead, scanBids, scanCards }
