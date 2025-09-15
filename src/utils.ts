import { Game } from 'bridge-commons/core/classes'
import { DEFAULT_CONVENTIONS, DEFAULT_OPTIONS } from 'bridge-commons/core/constants'

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
    conventions: { NS: DEFAULT_CONVENTIONS, EW: DEFAULT_CONVENTIONS },
    options: DEFAULT_OPTIONS
  }

  return Game.fromArgineData(argineFormat)
}
