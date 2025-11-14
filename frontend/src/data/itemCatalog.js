export const SERVICE_TYPES = [
  'Dry cleaning',
  'Wash and Iron',
  'Iron only',
  'Iron Urgent',
  'Alteration Only',
  'Leather care'
];

export const ITEM_CATALOG = [
  {
    id: 'men',
    name: 'Men',
    items: [
      'Regular Garment',
      'Shirt',
      'T-Shirt',
      'Pants',
      'Jeans',
      'Kurta',
      'Jacket',
      'Blazer',
      'Suit (2 pcs)',
      'Suit (3 pcs)',
      'Overcoat',
      'Sweater',
      'Track Pant',
      'Dhoti'
    ]
  },
  {
    id: 'women',
    name: 'Women',
    items: [
      'Saree',
      'Blouse',
      'Kurti',
      'Lehenga',
      'Gown',
      'Dress',
      'Dupatta',
      'Leggings',
      'Cardigan',
      'Sweater',
      'Jacket',
      'Nighty'
    ]
  },
  {
    id: 'children',
    name: 'Children',
    items: [
      'Frock',
      'Kids Shirt',
      'Kids Pants',
      'Kids Kurta',
      'Kids Lehenga',
      'Kids Jacket',
      'School Uniform',
      'Sweatshirt',
      'Sports Jersey'
    ]
  },
  {
    id: 'household',
    name: 'Household',
    items: [
      'Bed Sheet (Single)',
      'Bed Sheet (Double)',
      'Blanket',
      'Quilt',
      'Curtain',
      'Towel',
      'Pillow Cover',
      'Carpet',
      'Table Cloth',
      'Cushion Cover'
    ]
  },
  {
    id: 'institutional',
    name: 'Institutional',
    items: ['Hospital Linen', 'Chef Coat', 'Lab Coat', 'School Blazer', 'Hotel Towel']
  },
  {
    id: 'others',
    name: 'Others',
    items: ['Belt', 'Cap', 'Bag', 'Stuffed Toy', 'Leather Shoes', 'Sports Shoes']
  }
];

export const allItemNames = ITEM_CATALOG.flatMap((category) => category.items);

