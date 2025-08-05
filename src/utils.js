import { ArgineInterface, QueryTypes } from 'midgard-commons/lib/argine-interface.js'
import * as bridge from 'midgard-commons/lib/bridge.js'

const argineInterface = new ArgineInterface()

export function formatToArgine(input) {
  return input
    .split('-')
    .map((part) => part.slice(0, 2))
    .join('')
}

export function getPlayerCards(distribution, player) {
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
      return 1
  }
}

// TODO : utiliser le bon scoring type dans les appels à Argine
export async function getCard(query) {
  const { data } = await argineInterface.callArgine(query, QueryTypes.Card)
  return data.value.slice(0, 2)
}

export async function getEval(query, player = bridge.PLAYER_SOUTH) {
  const { data } = await argineInterface.callArgine({ ...query, maskHand: getMaskForPlayer(player) }, QueryTypes.Eval)
  return data.value.split(';')
}

export async function getBidInfo(query) {
  const { data } = await argineInterface.callArgine(query, QueryTypes.BidInfo)
  return data.value.split(';').map(Number)
}

export function divideChunks(arr, chunkSize) {
  const result = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize))
  }
  return result
}

export function getPlayerHcp(cards) {
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

export function getPlayerCardsBySuits(cards) {
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
