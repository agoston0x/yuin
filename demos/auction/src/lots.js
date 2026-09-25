/**
 * The lots. Priced in a JPY stablecoin because that is how a Tokyo auction house would
 * price them, not because the currency is interesting — the point is that the bidder's
 * wallet has none of it and bids anyway.
 */
export const LOTS = [
  {
    id: 'juyondai',
    name: 'Juyondai Ryuu no Otoshigo',
    detail: 'Junmai Daiginjo · 720ml · 2023',
    priceJpy: 48000n,
  },
  {
    id: 'dassai-beyond',
    name: 'Dassai Beyond',
    detail: 'Junmai Daiginjo · 720ml',
    priceJpy: 39000n,
  },
  {
    id: 'kokuryu',
    name: 'Kokuryu Ishidaya',
    detail: 'Daiginjo · 720ml · 2022',
    priceJpy: 27000n,
  },
]

export function lotById(id) {
  return LOTS.find((lot) => lot.id === id)
}
