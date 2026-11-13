// The shop's dry cleaning price list, from the "Rainbow Dry Cleaners & Laundrette" price list PDF.
// Names are in small letters without dashes, to make them easy to search.
// It is copied into the price_list table the first time the server starts; after that the
// admin changes prices in Admin → Price list.
//
// Each item has a Dry clean price and a Press only price. A single price is [price, price];
// a range like "£13.00 – £20.00" is [lowest, highest].

export const PRICE_LIST = [
  // Everyday
  {
    category: 'Everyday',
    name: 'trousers / jeans / track pants / chinos',
    clean: [6.5, 6.5],
    press: [3.5, 3.5],
  },
  {
    category: 'Everyday',
    name: 'shirt / tshirt / polo shirt',
    clean: [3.5, 3.5],
    press: [2, 2],
  },
  { category: 'Everyday', name: 'tie', clean: [3, 3], press: [1.5, 1.5] },
  {
    category: 'Everyday',
    name: 'waistcoat / vest',
    clean: [5, 5],
    press: [2, 2],
  },
  { category: 'Everyday', name: 'shorts', clean: [4, 4], press: [2.5, 2.5] },
  {
    category: 'Everyday',
    name: 'jumper (thin / wool / cotton)',
    clean: [5, 5],
    press: [2, 2],
  },
  {
    category: 'Everyday',
    name: 'jumper (thick) / hoody / sweatshirt',
    clean: [6.5, 6.5],
    press: [3.5, 3.5],
  },
  {
    category: 'Everyday',
    name: 'ladies top / blouse / tunic',
    clean: [4, 8],
    press: [3, 3],
  },
  { category: 'Everyday', name: 'skirt', clean: [6.5, 6.5], press: [3.5, 3.5] },
  {
    category: 'Everyday',
    name: 'pleated or long skirt',
    clean: [12, 12],
    press: [6, 6],
  },
  {
    category: 'Everyday',
    name: 'scarf / shawl',
    clean: [3.5, 7.5],
    press: [2, 4],
  },

  // Suits & coats
  {
    category: 'Suits & coats',
    name: 'jacket / blazer / sportcoat',
    clean: [7.5, 7.5],
    press: [3.5, 3.5],
  },
  {
    category: 'Suits & coats',
    name: '2pc suit',
    clean: [13, 13],
    press: [6.5, 6.5],
  },
  {
    category: 'Suits & coats',
    name: '3pc suit',
    clean: [16, 16],
    press: [7.5, 7.5],
  },
  {
    category: 'Suits & coats',
    name: 'small coat / blazerstyle coat',
    clean: [9, 9],
    press: [4.5, 4.5],
  },
  {
    category: 'Suits & coats',
    name: 'medium coat / everyday coat',
    clean: [10, 15],
    press: [5, 5],
  },
  {
    category: 'Suits & coats',
    name: 'long coat / puffy / overcoat',
    clean: [15, 25],
    press: [6.5, 6.5],
  },
  {
    category: 'Suits & coats',
    name: 'luxury coat (small) e.g. canada goose, moncler',
    clean: [25, 25],
    press: [9.5, 9.5],
  },
  {
    category: 'Suits & coats',
    name: 'luxury coat (large) e.g. canada goose, moncler',
    clean: [45, 45],
    press: [9.5, 9.5],
  },

  // Dresses
  {
    category: 'Dresses',
    name: 'dress (small)',
    clean: [12, 12],
    press: [6, 6],
  },
  {
    category: 'Dresses',
    name: 'dress (medium 3/4)',
    clean: [16, 16],
    press: [8, 8],
  },
  {
    category: 'Dresses',
    name: 'dress (long / beaded)',
    clean: [20, 30],
    press: [10, 30],
  },
  {
    category: 'Dresses',
    name: 'wedding dress',
    clean: [65, 120],
    press: [35, 45],
  },

  // Traditional wear
  {
    category: 'Traditional wear',
    name: "pakistani men's shalwar kameez",
    clean: [12, 12],
    press: [6, 6],
  },
  {
    category: 'Traditional wear',
    name: 'pakistani ladies shalwar kameez (2 pcs)',
    clean: [14, 14],
    press: [7, 7],
  },
  {
    category: 'Traditional wear',
    name: 'pakistani ladies shalwar kameez (3 pcs)',
    clean: [17, 17],
    press: [8.5, 8.5],
  },
  {
    category: 'Traditional wear',
    name: 'arabic juba / kandura / abaya',
    clean: [12, 12],
    press: [6, 6],
  },
  {
    category: 'Traditional wear',
    name: 'african suit (regular top, 2 pcs)',
    clean: [13, 13],
    press: [6, 6],
  },
  {
    category: 'Traditional wear',
    name: 'african suit (large top, 2 pcs)',
    clean: [20, 20],
    press: [10, 10],
  },
  {
    category: 'Traditional wear',
    name: 'african suit (3 pcs / extra large)',
    clean: [25, 25],
    press: [12.5, 12.5],
  },

  // Curtains
  {
    category: 'Curtains',
    name: 'curtains pair (small)',
    clean: [25, 25],
    press: [12.5, 12.5],
  },
  {
    category: 'Curtains',
    name: 'curtains pair (small lined)',
    clean: [30, 30],
    press: [15, 15],
  },
  {
    category: 'Curtains',
    name: 'curtains pair (large)',
    clean: [45, 45],
    press: [22.5, 22.5],
  },
  {
    category: 'Curtains',
    name: 'curtains pair (large lined)',
    clean: [50, 50],
    press: [25, 25],
  },
]

// The order the groups are shown in
export const CATEGORIES = ['Everyday', 'Suits & coats', 'Dresses', 'Traditional wear', 'Curtains']
