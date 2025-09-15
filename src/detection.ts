import fs from 'fs/promises'
import * as utils from './utils'
import { ArgineInterface, Card, Game, Player } from 'bridge-commons/core/classes'

// analyze()

const argineInterface = new ArgineInterface()
argineInterface.setArgineUrl('http://localhost:3000')

export async function analyze() {
  const raw = await fs.readFile('./src/mockData.json', 'utf-8')
  const games = JSON.parse(raw)

  for (const inputGame of games.slice(0, 5)) {
    const game = utils.parseToArgine(inputGame)

    if (Player.isSamePlayer(game.contract?.leader, Player.S)) {
      await scanLead(game)
    }

    await scanBids(game)

    await scanCards(game)
  }
}

async function scanLead(game: Game) {
  try {
    const query = { ...game.toArgine() }
    query.game.cards = ''

    const argineLead = Card.fromName(await argineInterface.getCard(query), Player.S)
    const playerLead = game.playedCards.at(0)!

    const leadEval = (await argineInterface.getEval(query, Player.S))[0]

    const playerCards = game.distribution.getByPlayer(Player.S)

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
  const TOLERANCE = {
    card: 1,
    hcp: 2
  }

  const query = game.toArgine()

  for (const [idx, bid] of game.bidList.entries()) {
    if (Player.isSamePlayer(bid.player, Player.S)) {
      query.game.bids = game.bidList.toArgineString().slice(0, (idx + 1) * 2)

      const bidInfo = await argineInterface.getBidInfo(query)

      // for (const suit of constants.SUITS) {
      //   const playerSuitSize = game.distribution.getBySuit(suit).getByPlayer(Player.S).length
      //   const suitInfo = bidInfo.getBySuit(suit)

      //   if (playerSuitSize < suitInfo.min - TOLERANCE.card || playerSuitSize > suitInfo.max + TOLERANCE.card) {
      //     console.log(`${utils.suitNames[suit]}: ${playerSuitSize} cartes (attendu: ${suitInfo.min}-${suitInfo.max})`)
      //   }
      // }

      // const playerHcp = game.distribution.getByPlayer(Player.S).hcp
      // if (playerHcp < bidInfo.hcp.min - TOLERANCE.hcp || playerHcp > bidInfo.hcp.max + TOLERANCE.hcp) {
      //   console.log(`HCP: ${playerHcp} (attendu: ${bidInfo.hcp.min}-${bidInfo.hcp.max})`)
      // }
    }
  }
}

// TODO : Je regarde si le nombre de levées est populaire (pour les joueurs au même atout et les joueurs au même contrat)
async function scanCards(game: Game) {
  const query = { ...game.toArgine() }

  const cardsEval = {
    south: await argineInterface.getEval(query, Player.S),
    north: await argineInterface.getEval(query, Player.N)
  }

  for (const [cardIdx, card] of game.playedCards.entries()) {
    // We don't analyze cards with idx > 48 (last trick, player don't have any choice)
    if (
      cardIdx < 48 &&
      (Player.isSamePlayer(card.player, Player.S) || (Player.isSamePlayer(card.player, Player.N) && Player.isSamePlayer(game.contract?.declarer, Player.S)))
    ) {
      query.game.cards = game.playedCards.toArgineString().slice(0, cardIdx * 2)

      const playerCards = game.distribution.getByPlayer(Player.S)
      const argineCard = Card.fromName(await argineInterface.getCard(query), Player.S)

      const argineCardIdx = 12 - playerCards.indexOf(argineCard)
      const playerLeadIdx = 12 - playerCards.indexOf(card)

      const playerEval = Player.isSamePlayer(card.player, Player.S) ? cardsEval.south : cardsEval.north
      const argineCardEval = playerEval[cardIdx][argineCardIdx]
      const playerCardEval = playerEval[cardIdx][playerLeadIdx]

      if (playerCardEval > argineCardEval) {
        console.log(`Carte jouée: ${card.toString()} ${playerCardEval}, Carte Argine: ${argineCard.toString()} ${argineCardEval}`)
      }
    }
  }
}
