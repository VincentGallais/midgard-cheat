import fs from 'fs/promises'
import { constants } from 'bridge-commons/core'
import { Game } from 'bridge-commons/core/classes'
import * as utils from './utils'

const MASK_S = 1
const TOLERANCE = {
  card: 1,
  hcp: 2
}
analyze()

export async function analyze() {
  const raw = await fs.readFile('./src/mockData.json', 'utf-8')
  const games = JSON.parse(raw)

  for (const inputGame of games.slice(1, 2)) {
    const game = utils.parseToArgine(inputGame)

    // if (game.contract!.leader == constants.PLAYER_S) {
    //   await scanLead(game)
    // }

    // await scanBids(game)

    await scanCards(game)
  }
}

async function scanLead(game: Game) {
  try {
    const query = { ...game.toArgine() }
    query.game.cards = ''

    const argineLead = await utils.getCard(query)
    const playerLead = game.playedCards.at(0)!

    const leadEval = (await utils.getEval(query)).slice(0, 13)

    const playerCards = game.distribution.getByPlayer(constants.PLAYER_S)

    // Index of eval cards is reversed
    const argineLeadIdx = 12 - playerCards.indexOf(argineLead)
    const playerLeadIdx = 12 - playerCards.indexOf(playerLead)

    const argineLeadEval = leadEval[argineLeadIdx]
    const playerLeadEval = leadEval[playerLeadIdx]

    // TODO : regarder si l'entame est populaire (pour les joueurs au même atout et les joueurs au même contrat)
  } catch (e) {
    console.error(`Error`, e)
  }
}

async function scanBids(game: Game) {
  const query = game.toArgine()

  for (const [idx, bid] of game.bidList.entries()) {
    if (bid.player === constants.PLAYER_S) {
      query.game.bids = game.bidList.toArgineString().slice(0, (idx + 1) * 2)

      const bidInfo = await utils.getBidInfo(query)

      for (const suit of constants.SUITS) {
        const playerSuitSize = game.distribution.getBySuit(suit).getByPlayer(constants.PLAYER_S).size
        const suitInfo = bidInfo.getBySuit(suit)

        if (playerSuitSize < suitInfo.min - TOLERANCE.card || playerSuitSize > suitInfo.max + TOLERANCE.card) {
          console.log(`${utils.suitNames[suit]}: ${playerSuitSize} cartes (attendu: ${suitInfo.min}-${suitInfo.max})`)
        }
      }

      const playerHcp = game.distribution.getByPlayer(constants.PLAYER_S).hcp
      if (playerHcp < bidInfo.hcp.min - TOLERANCE.hcp || playerHcp > bidInfo.hcp.max + TOLERANCE.hcp) {
        console.log(`HCP: ${playerHcp} (attendu: ${bidInfo.hcp.min}-${bidInfo.hcp.max})`)
      }
    }
  }
}

// TODO : Je regarde si le nombre de levées est populaire (pour les joueurs au même atout et les joueurs au même contrat)
async function scanCards(game: Game) {
  for (const [idx, card] of game.playedCards.entries()) {
    if (card.player === constants.PLAYER_S || (card.player === constants.PLAYER_N && game.contract?.declarer === constants.PLAYER_S)) {
      const query = { ...game.toArgine() }
      query.game.cards = game.playedCards.toArgineString().slice(0, idx * 2)

      const argineCard = await utils.getCard(query)

      console.log(`Carte jouée: ${card.toString()}, Carte Argine: ${argineCard.toString()}`)

      // Je compare à eval, pour voir si c'était mieux ou moins bien
    }
  }
}
