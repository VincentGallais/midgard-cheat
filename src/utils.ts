import { Card, Game } from 'bridge-commons/core/classes'
import { ArgineInterface, QueryTypes } from 'midgard-commons/lib/argine-interface.js'
import { constants } from 'bridge-commons/core'

const argineInterface = new ArgineInterface()

interface SuitInfo {
  min: number
  max: number
}

class BidInfo {
  public c: SuitInfo
  public d: SuitInfo
  public h: SuitInfo
  public s: SuitInfo
  public hcp: SuitInfo
  public meaning: string
  public forcing: number

  protected constructor(c: SuitInfo, d: SuitInfo, h: SuitInfo, s: SuitInfo, hcp: SuitInfo, meaning: string, forcing: number) {
    this.c = c
    this.d = d
    this.h = h
    this.s = s
    this.hcp = hcp
    this.meaning = meaning
    this.forcing = forcing
  }

  public getBySuit(suit: any): SuitInfo {
    switch (suit) {
      case constants.SUIT_C:
        return this.c
      case constants.SUIT_D:
        return this.d
      case constants.SUIT_H:
        return this.h
      case constants.SUIT_S:
        return this.s
      default:
        throw new Error(`Unknown suit: ${suit}`)
    }
  }

  static fromArgineData(splitedValue: string[]): BidInfo {
    return new BidInfo(
      { min: Number(splitedValue[0]), max: Number(splitedValue[1]) }, // club
      { min: Number(splitedValue[2]), max: Number(splitedValue[3]) }, // diamond
      { min: Number(splitedValue[4]), max: Number(splitedValue[5]) }, // heart
      { min: Number(splitedValue[6]), max: Number(splitedValue[7]) }, // spade
      { min: Number(splitedValue[10]), max: Number(splitedValue[11]) }, // hcp
      splitedValue[12], // meaning
      Number(splitedValue[13]) // forcing
    )
  }
}

export const suitNames = {
  [constants.SUIT_C]: 'Trèfles',
  [constants.SUIT_D]: 'Carreaux',
  [constants.SUIT_H]: 'Cœurs',
  [constants.SUIT_S]: 'Piques'
}

// TODO : Mettre PlayerPosition
function getPlayerMask(player: any) {
  switch (player) {
    case constants.PLAYER_S:
      return 1
    case constants.PLAYER_W:
      return 2
    case constants.PLAYER_N:
      return 4
    case constants.PLAYER_E:
      return 8
    default:
      throw new Error(`Unknown player position: ${player}`)
  }
}

// TODO : Créer un type ArgineQuery dans la lib
export async function getCard(query: any) {
  const { data } = await argineInterface.callArgine(query, QueryTypes.Card)
  return Card.fromName(data.value.slice(0, 2), constants.PLAYER_S)
}

export async function getEval(query: any, player = constants.PLAYER_S) {
  const { data } = await argineInterface.callArgine({ ...query, maskHand: getPlayerMask(player) }, QueryTypes.Eval)
  return data.value.split(';')
}

export async function getBidInfo(query: any): Promise<BidInfo> {
  const { data } = await argineInterface.callArgine(query, QueryTypes.BidInfo)
  const splitedValue = data.value.split(';')
  return BidInfo.fromArgineData(splitedValue)
}

function splitData(input: string) {
  return input
    .split('-')
    .map((part) => part.slice(0, 2))
    .join('')
}

// TODO : Mettre les conventions et les options correctes
export function parseToArgine(game: any) {
  const argineFormat = {
    deal: {
      dealer: game.CD_dealer,
      vulnerability: game.CD_vulnerability,
      distribution: game.ST_distribution
    },
    game: {
      cards: splitData(game.ST_cards),
      bids: splitData(game.ST_bids)
    },
    conventions: { NS: constants.DEFAULT_CONVENTIONS, EW: constants.DEFAULT_CONVENTIONS },
    options: { argineConfidence: 0, scoringType: 0 }
  }

  return Game.fromArgineData(argineFormat)
}
