/**
 * Single source of truth for the entire menu, categories, combos and offers.
 * Every dish rendered anywhere in the app (home sections, menu page, checkout
 * suggestions) references dishes from here so cart/wishlist keys stay unified.
 */

export interface Category {
  id: string; // anchor slug, e.g. 'main-course'
  name: string;
  emoji: string;
}

export interface Dish {
  key: string; // unique dishId used by cart & wishlist
  /** Real DB id when served from /api/menu (equals key for catalog items). */
  id?: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  isVeg: boolean;
  image: string;
  imageAlt: string;
  categoryId: string; // must match a Category.id
  /** DB category slug (same value as categoryId for API-served items). */
  category?: string;
  badge?: string;
  isBestseller?: boolean;
  sizes?: string[];
  /** Sale price when set (admin panel only); null/absent = no discount. */
  discountPrice?: number | null;
  /** false = hidden as out of stock. API items are always available (server filters). */
  inStock?: boolean;
}

export interface Combo {
  id: number;
  saveBadge: string;
  isNew?: boolean;
  isLimited?: boolean;
  name: string;
  description: string;
  originalPrice: number;
  salePrice: number;
  image: string;
  imageAlt: string;
}

export interface Offer {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'flat' | 'percent' | 'free-delivery';
  value: number; // flat ₹ amount or percent
  minOrder: number; // minimum subtotal to use this offer
  expiry: string;
  badge?: string;
  /** 'small' = directly claimable; 'big' = riddle-gated (see riddle/answer). */
  tier: 'small' | 'big';
  /** Question shown on big-tier cards to unlock the code. */
  riddle?: string;
  /**
   * Accepted answer for big-tier offers. NOTE: answers ship in the frontend
   * bundle for now — a determined user could inspect them. When the real
   * coupon backend lands, validate riddles server-side instead.
   */
  answer?: string;
}

export const DELIVERY_FEE = 40;

export const categories: Category[] = [
  { id: 'main-course', name: 'Main Courses', emoji: '🍛' },
  { id: 'burgers', name: 'Burgers', emoji: '🍔' },
  { id: 'seafood', name: 'Seafood', emoji: '🦐' },
  { id: 'vegetarian', name: 'Vegetarian', emoji: '🥦' },
  { id: 'soups', name: 'Soups', emoji: '🍲' },
  { id: 'grilled-meat', name: 'Grilled Meat', emoji: '🥩' },
  { id: 'salads', name: 'Salads', emoji: '🥙' },
  { id: 'beverages', name: 'Beverages', emoji: '🥤' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'speciality', name: 'Speciality', emoji: '✨' },
  { id: 'pasta', name: 'Pasta', emoji: '🍝' },
  { id: 'side-dishes', name: 'Side Dishes', emoji: '🍟' },
  { id: 'starters', name: 'Starters', emoji: '🍢' },
];

export const menuItems: Dish[] = [
  // ── Main Courses ────────────────────────────────────────────────
  {
    key: 'zinger-burger',
    categoryId: 'main-course',
    name: 'Zinger Tower Burger',
    description:
      'Crispy chicken fillet, double cheese slices, jalapeños, signature zinger sauce in a toasted bun',
    price: 189,
    rating: 4.4,
    isVeg: false,
    isBestseller: true,
    sizes: ['Regular', 'Medium', 'Large'],
    image: '/images/dishes/zinger-burger.webp',
    imageAlt: 'Tall stacked zinger burger with crispy chicken and cheese on a dark background',
  },
  {
    key: 'bbq-burger',
    categoryId: 'main-course',
    name: 'Smoky BBQ Crunch Burger',
    description:
      'Double beef patty, caramelised onions, crispy onion rings, smoky BBQ sauce, pickles',
    price: 219,
    rating: 4.3,
    isVeg: false,
    sizes: ['Regular', 'Large'],
    image: '/images/dishes/bbq-burger.webp',
    imageAlt: 'Smoky BBQ burger with caramelised onions and double beef patty on a wooden board',
  },
  {
    key: 'veggie-burger',
    categoryId: 'main-course',
    name: 'Veggie Crunch Burger',
    description:
      'Crispy aloo tikki patty, fresh lettuce, tomato, mint chutney, chipotle mayo in a soft bun',
    price: 149,
    rating: 4.2,
    isVeg: true,
    sizes: ['Regular', 'Large'],
    image: '/images/dishes/3.webp',
    imageAlt:
      'Fresh veggie burger with green lettuce and colourful toppings on a bright background',
  },
  {
    key: 'nashville-burger',
    categoryId: 'main-course',
    name: 'Fiery Nashville Hot Burger',
    description:
      'Buttermilk-fried chicken tossed in Nashville hot sauce, pickles, slaw, honey drizzle',
    price: 239,
    rating: 4.5,
    isVeg: false,
    isBestseller: true,
    image: '/images/dishes/nashville-burger.webp',
    imageAlt: 'Spicy Nashville hot burger with red sauce and coleslaw on a dark background',
  },
  {
    key: 'stir-fry',
    categoryId: 'main-course',
    name: 'Vegetable Stir-Fry',
    description:
      'Colourful bell peppers, broccoli, snap peas and mushrooms tossed in a garlic-soy glaze',
    price: 879,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/stir-fry.webp',
    imageAlt: 'Colourful vegetable stir-fry with bell peppers and broccoli in a wok',
  },
  {
    key: 'mushroom-risotto',
    categoryId: 'main-course',
    name: 'Mushroom Risotto',
    description: 'Creamy arborio rice with sautéed mushrooms, parmesan and fresh thyme',
    price: 387,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/mushroom-risotto.webp',
    imageAlt: 'Creamy mushroom risotto with parmesan and fresh herbs in a white bowl',
  },
  {
    key: 'cauliflower-tikka',
    categoryId: 'main-course',
    name: 'Cauliflower Tikka Masala',
    description: 'Charred cauliflower florets simmered in a rich tomato-cashew gravy with naan',
    price: 290,
    rating: 4.5,
    isVeg: true,
    image: '/images/dishes/cauliflower-tikka.webp',
    imageAlt: 'Creamy cauliflower tikka masala curry in a dark bowl with naan bread',
  },
  {
    key: 'black-bean-tacos',
    categoryId: 'main-course',
    name: 'Black Bean Tacos',
    description: 'Spiced black beans, pico de gallo, avocado crema and lime in warm corn tortillas',
    price: 350,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/black-bean-tacos.webp',
    imageAlt: 'Black bean tacos with salsa and lime on a colourful plate',
  },

  // ── Seafood ─────────────────────────────────────────────────────
  {
    key: 'calamari',
    categoryId: 'seafood',
    name: 'Crispy Calamari',
    description: 'Golden crispy calamari rings with lemon zest and a zesty garlic aioli',
    price: 290,
    rating: 4.4,
    isVeg: false,
    badge: 'Now Available',
    image: '/images/dishes/calamari.webp',
    imageAlt: 'Golden crispy fried calamari rings on a white plate with dipping sauce',
  },
  {
    key: 'scallops',
    categoryId: 'seafood',
    name: 'Seared Scallops',
    description: 'Butter-seared scallops with herb butter, microgreens and lemon beurre blanc',
    price: 280,
    rating: 4.6,
    isVeg: false,
    badge: 'Top Choice',
    image: '/images/dishes/scallops.webp',
    imageAlt: 'Golden seared scallops with herb sauce on a white plate',
  },
  {
    key: 'prawn-tempura',
    categoryId: 'seafood',
    name: 'Prawn Tempura',
    description: 'Crispy prawn tempura with a tangy soy-dashi dipping sauce',
    price: 350,
    rating: 4.5,
    isVeg: false,
    badge: 'New Flavors',
    image: '/images/dishes/prawn-tempura.webp',
    imageAlt: 'Crispy prawn tempura with dipping sauce on a wooden board',
  },
  {
    key: 'grilled-fish',
    categoryId: 'seafood',
    name: 'Grilled Lemon Butter Fish',
    description: 'Pan-grilled basa fillet with lemon butter, herbs and charred seasonal vegetables',
    price: 420,
    rating: 4.2,
    isVeg: false,
    image: '/images/categories/cat_seafood.webp',
    imageAlt: 'Grilled seafood platter with prawns and fish on a dark background',
  },

  // ── Vegetarian ──────────────────────────────────────────────────
  {
    key: 'stuffed-peppers',
    categoryId: 'vegetarian',
    name: 'Stuffed Bell Peppers',
    description: 'Roasted bell peppers filled with herbed rice, vegetables and melted cheese',
    price: 329,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/stuffed-peppers.webp',
    imageAlt: 'Stuffed bell peppers filled with rice and vegetables on a dark plate',
  },
  {
    key: 'chickpea-curry',
    categoryId: 'vegetarian',
    name: 'Chickpea & Potato Curry',
    description: 'Hearty chana masala with soft potatoes, onions, tomatoes and warm spices',
    price: 279,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/chickpea-curry.webp',
    imageAlt: 'Rich chickpea and potato curry in a dark bowl with herbs and spices',
  },
  {
    key: 'eggplant-parmesan',
    categoryId: 'vegetarian',
    name: 'Eggplant Parmesan',
    description: 'Baked eggplant layered with tomato sauce, mozzarella and crispy breadcrumbs',
    price: 403,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/eggplant-parmesan.webp',
    imageAlt: 'Baked eggplant parmesan with tomato sauce and melted cheese on a white plate',
  },
  {
    key: 'veg-chili',
    categoryId: 'vegetarian',
    name: 'Vegetarian Chili',
    description: 'Rich three-bean chili with smoky spices, corn and a dollop of sour cream',
    price: 370,
    rating: 4.5,
    isVeg: true,
    image: '/images/dishes/veg-chili.webp',
    imageAlt: 'Rich red vegetarian chili with beans in a dark bowl with chili garnish',
  },
  {
    key: 'acorn-squash',
    categoryId: 'vegetarian',
    name: 'Stuffed Acorn Squash',
    description: 'Baked acorn squash filled with wild rice, cranberries, pecans and herbs',
    price: 280,
    rating: 4.2,
    isVeg: true,
    image: '/images/dishes/acorn-squash.webp',
    imageAlt: 'Baked stuffed acorn squash with herbs on a wooden board, warm lighting',
  },

  // ── Soups ───────────────────────────────────────────────────────
  {
    key: 'lentil-soup',
    categoryId: 'soups',
    name: 'Lentil Soup',
    description: 'Slow-simmered red lentil soup with cumin, lemon and fresh coriander',
    price: 509,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/lentil-soup.webp',
    imageAlt: 'Creamy orange lentil soup in a white ceramic bowl with lemon wedge',
  },
  {
    key: 'butternut-squash-soup',
    categoryId: 'soups',
    name: 'Roasted Butternut Squash Soup',
    description: 'Silky roasted butternut squash soup with a cream swirl and toasted seeds',
    price: 341,
    rating: 4.3,
    isVeg: true,
    badge: 'New Arrivals',
    image: '/images/dishes/butternut-squash-soup.webp',
    imageAlt: 'Smooth roasted butternut squash soup in a dark bowl with cream swirl and seeds',
  },
  {
    key: 'tomato-basil-soup',
    categoryId: 'soups',
    name: 'Tomato Basil Soup',
    description: 'Classic roasted tomato soup with fresh basil and a parmesan crisp',
    price: 199,
    rating: 4.2,
    isVeg: true,
    image: '/images/categories/cat_soups.webp',
    imageAlt: 'Creamy orange soup in a white bowl with herbs on top',
  },
  {
    key: 'cream-mushroom-soup',
    categoryId: 'soups',
    name: 'Cream of Mushroom Soup',
    description: 'Velvety mushroom soup with garlic, thyme and a swirl of cream',
    price: 229,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/cream-mushroom-soup.webp',
    imageAlt: 'Creamy mushroom soup in a dark bowl topped with herbs and cream',
  },

  // ── Grilled Meat ────────────────────────────────────────────────
  {
    key: 'ribeye',
    categoryId: 'grilled-meat',
    name: 'Grilled Ribeye Steak',
    description: 'Perfectly grilled ribeye with herb butter, roasted tomatoes and charred greens',
    price: 879,
    rating: 4.5,
    isVeg: false,
    isBestseller: true,
    image: '/images/dishes/ribeye.webp',
    imageAlt: 'Perfectly grilled ribeye steak with herbs on a wooden board with tomatoes',
  },
  {
    key: 'tandoori-chicken',
    categoryId: 'grilled-meat',
    name: 'Tandoori Chicken',
    description: 'Char-grilled chicken marinated in yoghurt, ginger, garlic and tandoori spices',
    price: 399,
    rating: 4.4,
    isVeg: false,
    image: '/images/dishes/tandoori-chicken.webp',
    imageAlt: 'Charred tandoori chicken pieces with spices on a dark plate',
  },
  {
    key: 'bbq-wings',
    categoryId: 'grilled-meat',
    name: 'BBQ Chicken Wings',
    description: 'Sticky-sweet smoked BBQ wings with a spicy glaze and sesame garnish',
    price: 349,
    rating: 4.3,
    isVeg: false,
    image: '/images/dishes/bbq-wings.webp',
    imageAlt: 'Glazed barbecue chicken wings stacked on a dark plate',
  },
  {
    key: 'lamb-chops',
    categoryId: 'grilled-meat',
    name: 'Grilled Lamb Chops',
    description: 'Herb-crusted lamb chops grilled to order with mint jus and roasted garlic',
    price: 699,
    rating: 4.4,
    isVeg: false,
    image: '/images/dishes/lamb-chops.webp',
    imageAlt: 'Grilled lamb chops with rosemary on a wooden board',
  },

  // ── Salads ──────────────────────────────────────────────────────
  {
    key: 'caesar-salad',
    categoryId: 'salads',
    name: 'Caesar Salad',
    description: 'Crisp romaine, garlic croutons, shaved parmesan and classic Caesar dressing',
    price: 470,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/caesar-salad.webp',
    imageAlt: 'Fresh Caesar salad with croutons and parmesan shavings in a white bowl',
  },
  {
    key: 'quinoa-salad',
    categoryId: 'salads',
    name: 'Mediterranean Quinoa Salad',
    description: 'Quinoa with tomatoes, cucumber, feta, olives and a lemon-herb vinaigrette',
    price: 449,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/quinoa-salad.webp',
    imageAlt:
      'Colourful Mediterranean quinoa salad with tomatoes, cucumbers, and feta on a white bowl',
  },
  {
    key: 'greek-wraps',
    categoryId: 'salads',
    name: 'Greek Salad Wraps',
    description: 'Fresh vegetables, feta and olives wrapped with a zesty Greek dressing',
    price: 255,
    rating: 4.2,
    isVeg: true,
    image: '/images/dishes/greek-wraps.webp',
    imageAlt: 'Fresh Greek salad wrap with vegetables and feta on a wooden board',
  },
  {
    key: 'garden-salad',
    categoryId: 'salads',
    name: 'Fresh Garden Salad',
    description: 'Mixed greens, cherry tomatoes, cucumber, carrot ribbons and balsamic glaze',
    price: 299,
    rating: 4.1,
    isVeg: true,
    image: '/images/categories/cat_salads.webp',
    imageAlt: 'Fresh garden salad with colorful vegetables in a white bowl',
  },

  // ── Beverages ───────────────────────────────────────────────────
  {
    key: 'mango-lassi',
    categoryId: 'beverages',
    name: 'Mango Lassi',
    description: 'Thick chilled mango lassi made with Alphonso mangoes and yoghurt',
    price: 89,
    rating: 4.5,
    isVeg: true,
    sizes: ['Regular', 'Large'],
    image: '/images/dishes/mango-lassi.webp',
    imageAlt: 'Yellow mango lassi in a tall glass with a straw on a bright background',
  },
  {
    key: 'classic-pepsi',
    categoryId: 'beverages',
    name: 'Classic Pepsi',
    description: 'Ice-cold Pepsi served in a chilled cup',
    price: 49,
    rating: 4.2,
    isVeg: true,
    sizes: ['Regular', 'Medium', 'Large'],
    image: '/images/dishes/classic-pepsi.webp',
    imageAlt: 'Cold cola drink with ice in a tall glass on a dark background',
  },
  {
    key: 'watermelon-lemonade',
    categoryId: 'beverages',
    name: 'Watermelon Mint Lemonade',
    description: 'Refreshing watermelon juice blended with fresh mint and lemon',
    price: 99,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/watermelon-lemonade.webp',
    imageAlt: 'Pink watermelon lemonade with mint leaves in a glass on a bright background',
  },
  {
    key: 'cold-coffee-frappe',
    categoryId: 'beverages',
    name: 'Cold Coffee Frappe',
    description: 'Blended iced coffee with milk, sugar, and a scoop of vanilla ice cream',
    price: 129,
    rating: 4.6,
    isVeg: true,
    isBestseller: true,
    image: '/images/dishes/cold-coffee-frappe.webp',
    imageAlt: 'Cold coffee frappe with whipped cream and chocolate drizzle in a tall glass',
  },

  // ── Desserts ────────────────────────────────────────────────────
  {
    key: 'chocolate-lava-cake',
    categoryId: 'desserts',
    name: 'Chocolate Lava Cake',
    description: 'Warm dark chocolate cake with a molten centre, served with vanilla ice cream',
    price: 450,
    rating: 4.7,
    isVeg: true,
    isBestseller: true,
    image: '/images/dishes/chocolate-lava-cake.webp',
    imageAlt: 'Dark chocolate lava cake with molten center being cut open on a black plate',
  },
  {
    key: 'molten-brownie',
    categoryId: 'desserts',
    name: 'Molten Walnut Brownie',
    description: 'Gooey walnut brownie with a fudgy centre and chocolate drizzle',
    price: 249,
    rating: 4.5,
    isVeg: true,
    image: '/images/dishes/molten-brownie.webp',
    imageAlt: 'Chocolate brownie squares with fudge sauce on a dark plate',
  },
  {
    key: 'tiramisu',
    categoryId: 'desserts',
    name: 'Classic Tiramisu',
    description: 'Espresso-soaked ladyfingers layered with mascarpone and cocoa',
    price: 329,
    rating: 4.6,
    isVeg: true,
    image: '/images/dishes/tiramisu.webp',
    imageAlt: 'Classic tiramisu slice dusted with cocoa on a white plate',
  },
  {
    key: 'gulab-cheesecake',
    categoryId: 'desserts',
    name: 'Gulab Jamun Cheesecake',
    description: 'Baked cheesecake topped with warm gulab jamun and rose syrup',
    price: 289,
    rating: 4.4,
    isVeg: true,
    badge: 'New Flavor',
    image: '/images/categories/cat_desserts.webp',
    imageAlt: 'Elegant chocolate dessert cake with berries on a dark plate',
  },

  // ── Speciality ──────────────────────────────────────────────────
  {
    key: 'butter-chicken-biryani',
    categoryId: 'speciality',
    name: 'Butter Chicken Biryani',
    description: 'Fragrant basmati layered with creamy butter chicken, fried onions and saffron',
    price: 389,
    rating: 4.6,
    isVeg: false,
    isBestseller: true,
    image: '/images/dishes/butter-chicken-biryani.webp',
    imageAlt: 'Fragrant biryani with saffron rice and garnishes in a handi',
  },
  {
    key: 'paneer-biryani',
    categoryId: 'speciality',
    name: 'Paneer Tikka Biryani',
    description: 'Smoky paneer tikka layered with basmati, mint and a saffron-milk finish',
    price: 349,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/paneer-biryani.webp',
    imageAlt: 'Paneer tikka biryani served in a traditional pot with raita',
  },
  {
    key: 'dal-makhani',
    categoryId: 'speciality',
    name: 'Dal Makhani',
    description: 'Black lentils simmered overnight with butter, cream and aromatic spices',
    price: 279,
    rating: 4.5,
    isVeg: true,
    image: '/images/dishes/dal-makhani.webp',
    imageAlt: 'Creamy dal makhani in a copper bowl with butter swirl',
  },
  {
    key: 'rogan-josh',
    categoryId: 'speciality',
    name: 'Rogan Josh',
    description: 'Kashmiri-style slow-cooked lamb curry with whole spices and yoghurt',
    price: 429,
    rating: 4.5,
    isVeg: false,
    image: '/images/dishes/rogan-josh.webp',
    imageAlt: 'Rich red rogan josh curry in a dark bowl with fresh coriander',
  },

  // ── Pasta ───────────────────────────────────────────────────────
  {
    key: 'ravioli',
    categoryId: 'pasta',
    name: 'Spinach & Ricotta Ravioli',
    description: 'Handmade ravioli with a creamy herb sauce and shaved parmesan',
    price: 357,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/ravioli.webp',
    imageAlt: 'Fresh pasta ravioli with cream sauce and herbs on a white plate',
  },
  {
    key: 'zucchini-pesto',
    categoryId: 'pasta',
    name: 'Zucchini Noodles with Pesto',
    description: 'Fresh zucchini ribbons tossed in basil pesto, pine nuts and cherry tomatoes',
    price: 180,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/zucchini-pesto.webp',
    imageAlt: 'Fresh zucchini noodles with green pesto sauce in a white bowl',
  },
  {
    key: 'penne-arrabbiata',
    categoryId: 'pasta',
    name: 'Penne Arrabbiata',
    description: 'Penne tossed in a fiery tomato-chilli sauce with garlic and basil',
    price: 319,
    rating: 4.2,
    isVeg: true,
    image: '/images/dishes/penne-arrabbiata.webp',
    imageAlt: 'Penne pasta with tomato sauce and herbs on a white plate',
  },
  {
    key: 'alfredo-pasta',
    categoryId: 'pasta',
    name: 'Creamy Alfredo Pasta',
    description: 'Fettuccine in a silky parmesan cream sauce with grilled mushrooms',
    price: 379,
    rating: 4.5,
    isVeg: true,
    image: '/images/categories/cat_pasta.webp',
    imageAlt: 'Creamy pasta dish with sauce being poured from above',
  },

  // ── Side Dishes ─────────────────────────────────────────────────
  {
    key: 'salted-fries',
    categoryId: 'side-dishes',
    name: 'Crispy Salted Fries',
    description: 'Golden crispy fries seasoned with sea salt and our secret spice blend',
    price: 79,
    rating: 4.2,
    isVeg: true,
    sizes: ['Regular', 'Medium', 'Large'],
    image: '/images/dishes/salted-fries.webp',
    imageAlt: 'Golden crispy french fries in a paper cup on a white background',
  },
  {
    key: 'peri-peri-fries',
    categoryId: 'side-dishes',
    name: 'Peri Peri Fries',
    description: 'Crispy fries tossed in fiery peri peri seasoning with a garlic mayo dip',
    price: 99,
    rating: 4.5,
    isVeg: true,
    isBestseller: true,
    sizes: ['Regular', 'Large'],
    image: '/images/dishes/peri-peri-fries.webp',
    imageAlt: 'Spicy peri peri fries with seasoning and dipping sauce on a dark background',
  },
  {
    key: 'coleslaw',
    categoryId: 'side-dishes',
    name: 'Coleslaw',
    description: 'Fresh creamy coleslaw with cabbage, carrots, and our house dressing',
    price: 59,
    rating: 4.1,
    isVeg: true,
    image: '/images/dishes/coleslaw.webp',
    imageAlt: 'Creamy coleslaw in a white bowl with fresh vegetables',
  },
  {
    key: 'corn-on-cob',
    categoryId: 'side-dishes',
    name: 'Corn on the Cob',
    description: 'Grilled corn on the cob with herb butter and a squeeze of lime',
    price: 89,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/corn-on-cob.webp',
    imageAlt: 'Grilled corn on the cob with butter and herbs on a wooden board',
  },
  {
    key: 'garlic-bread',
    categoryId: 'side-dishes',
    name: 'Garlic Bread',
    description: 'Toasted baguette brushed with garlic butter, herbs and melted mozzarella',
    price: 129,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/garlic-bread.webp',
    imageAlt: 'Toasted garlic bread slices with herbs and melted cheese',
  },
  {
    key: 'onion-rings',
    categoryId: 'side-dishes',
    name: 'Crispy Onion Rings',
    description: 'Beer-battered onion rings fried golden with a smoky ketchup dip',
    price: 149,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/onion-rings.webp',
    imageAlt: 'Golden crispy onion rings stacked on a dark plate with dip',
  },

  // ── Starters ────────────────────────────────────────────────────
  {
    key: 'spring-rolls',
    categoryId: 'starters',
    name: 'Veg Spring Rolls',
    description: 'Crispy rolls stuffed with glass noodles, vegetables and sweet chilli dip',
    price: 199,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/spring-rolls.webp',
    imageAlt: 'Golden crispy spring rolls with dipping sauce on a dark plate',
  },
  {
    key: 'paneer-tikka',
    categoryId: 'starters',
    name: 'Paneer Tikka',
    description: 'Char-grilled paneer cubes marinated in spiced yoghurt with mint chutney',
    price: 279,
    rating: 4.5,
    isVeg: true,
    isBestseller: true,
    image: '/images/dishes/paneer-tikka.webp',
    imageAlt: 'Char-grilled paneer tikka skewers with vegetables and mint chutney',
  },
  {
    key: 'crispy-corn',
    categoryId: 'starters',
    name: 'Crispy Corn',
    description: 'Golden fried corn kernels tossed in chilli, garlic and pepper salt',
    price: 189,
    rating: 4.2,
    isVeg: true,
    image: '/images/dishes/crispy-corn.webp',
    imageAlt: 'Crispy golden corn kernels in a paper basket with seasoning',
  },
  {
    key: 'corn-tomato-fritters',
    categoryId: 'starters',
    name: 'Corn & Tomato Fritters',
    description: 'Pan-fried fritters of sweet corn and tomato with a tangy dip',
    price: 150,
    rating: 4.3,
    isVeg: true,
    image: '/images/dishes/corn-tomato-fritters.webp',
    imageAlt: 'Golden corn and tomato fritters on a dark plate with sauce',
  },
  {
    key: 'hara-bhara-kebab',
    categoryId: 'starters',
    name: 'Hara Bhara Kebab',
    description: 'Spinach, peas and potato kebabs grilled with a mint-yoghurt dip',
    price: 229,
    rating: 4.4,
    isVeg: true,
    image: '/images/dishes/hara-bhara-kebab.webp',
    imageAlt: 'Green vegetable kebabs served with chutney on a wooden board',
  },
];

export const combos: Combo[] = [
  {
    id: 1,
    saveBadge: 'Save 20%',
    name: 'Zinger Meal Deal',
    description:
      'Zinger Tower Burger (Regular) + Crispy Salted Fries (Medium) + Pepsi (Regular) — the classic combo',
    originalPrice: 337,
    salePrice: 269,
    image: '/images/dishes/1.webp',
    imageAlt: 'Classic burger meal deal with fries and cola on a dark background',
  },
  {
    id: 2,
    saveBadge: 'Save 25%',
    name: 'Family Feast Box',
    description:
      '4 Classic Chicken Burgers + 2 Large Fries + 4 Pepsi Regulars — feeds the whole crew',
    originalPrice: 1196,
    salePrice: 899,
    image: '/images/dishes/2.webp',
    imageAlt: 'Family meal box with multiple burgers and fries on a wooden board',
  },
  {
    id: 3,
    saveBadge: 'Save 19%',
    isNew: true,
    isLimited: true,
    name: 'Veggie Fiesta Combo',
    description:
      'Veggie Crunch Burger + Peri Peri Fries + Mango Lassi — full vegetarian satisfaction',
    originalPrice: 357,
    salePrice: 289,
    image: '/images/dishes/3.webp',
    imageAlt: 'Veggie burger combo with fries and mango lassi on a bright background',
  },
];

export const offers: Offer[] = [
  {
    id: 'save10',
    code: 'SAVE10',
    title: '10% off your order',
    description: 'Flat 10% off on any order above ₹299.',
    type: 'percent',
    value: 10,
    minOrder: 299,
    expiry: '31 Aug 2026',
    badge: 'Most used',
    tier: 'small',
  },
  {
    id: 'flat50',
    code: 'FLAT50',
    title: 'Flat ₹50 off',
    description: 'Flat ₹50 off on orders above ₹199.',
    type: 'flat',
    value: 50,
    minOrder: 199,
    expiry: '15 Sep 2026',
    tier: 'small',
  },
  {
    id: 'freedel',
    code: 'FREEDEL',
    title: 'Free delivery',
    description: 'No delivery fee on orders above ₹399.',
    type: 'free-delivery',
    value: 0,
    minOrder: 399,
    expiry: '31 Aug 2026',
    badge: 'New',
    tier: 'small',
  },
  {
    id: 'welcome20',
    code: 'WELCOME20',
    title: '20% off your first order',
    description: '20% off (up to ₹100) on your first order above ₹499.',
    type: 'percent',
    value: 20,
    minOrder: 499,
    expiry: '31 Dec 2026',
    badge: 'New user',
    tier: 'big',
    riddle: 'I’m a tall stack — buns, patty, cheese, sauce. Fast food’s crown jewel. What am I?',
    answer: 'burger',
  },
  {
    id: 'bigfeast',
    code: 'BIGFEAST',
    title: 'Flat ₹100 off a feast',
    description: 'Flat ₹100 off on orders above ₹799 — for the hungry ones.',
    type: 'flat',
    value: 100,
    minOrder: 799,
    expiry: '30 Sep 2026',
    badge: 'Special',
    tier: 'big',
    riddle:
      'I’m baked in a clay oven, charred at the edges, and best friends with mint chutney. What am I?',
    answer: 'paneer tikka',
  },
];

/** Look a coupon up by code (case-insensitive). */
export function findOfferByCode(code: string): Offer | undefined {
  const c = code.trim().toUpperCase();
  return offers.find((o) => o.code === c);
}

/** Discount (₹) an offer gives on a subtotal; free-delivery offers discount ₹0. */
export function getOfferDiscount(offer: Offer, subtotal: number): number {
  if (subtotal < offer.minOrder) return 0;
  if (offer.type === 'flat') return Math.min(offer.value, subtotal);
  if (offer.type === 'percent') return Math.round((subtotal * offer.value) / 100);
  return 0;
}

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export const dishByKey: Record<string, Dish> = Object.fromEntries(menuItems.map((d) => [d.key, d]));
