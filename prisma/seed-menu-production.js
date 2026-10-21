const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PIN_BTM = JSON.stringify(['560076', '560078', '560103']);
const PIN_INDIRANAGAR = JSON.stringify(['560038', '560075', '560008']);

const MENU = [
  { id: 'item_classic_chicken_burger', name: 'Classic Chicken Burger', category: 'burgers', price: 149, veg: false, desc: 'Crispy fried chicken, lettuce, house mayo in a toasted bun.', imageUrl: '/images/dishes/zinger-burger.webp' },
  { id: 'item_crispy_veg_burger', name: 'Crispy Veg Burger', category: 'burgers', price: 119, veg: true, desc: 'Crunchy veg patty with fresh veggies and tangy sauce.', imageUrl: '/images/dishes/veggie-burger.webp' },
  { id: 'item_double_decker_burger', name: 'Double Decker Burger', category: 'burgers', price: 199, veg: false, desc: 'Two juicy patties, double cheese, pickles and special sauce.', imageUrl: '/images/dishes/bbq-burger.webp' },
  { id: 'item_paneer_tikka_burger', name: 'Paneer Tikka Burger', category: 'burgers', price: 139, veg: true, desc: 'Smoky paneer tikka patty with mint mayo.', imageUrl: '/images/dishes/paneer-tikka.webp' },
  { id: 'item_peri_peri_fries', name: 'Peri Peri Fries', category: 'side-dishes', price: 99, veg: true, desc: 'Crispy fries dusted with fiery peri peri seasoning.', imageUrl: '/images/dishes/peri-peri-fries.webp', isBestseller: true },
  { id: 'item_masala_fries', name: 'Masala Fries', category: 'side-dishes', price: 89, veg: true, desc: 'Fries tossed in Indian spice mix with a side of ketchup.', imageUrl: '/images/dishes/salted-fries.webp' },
  { id: 'item_chicken_wings', name: 'Spicy Chicken Wings (6 pc)', category: 'starters', price: 179, veg: false, desc: 'Sticky-spicy wings with cooling ranch dip.', imageUrl: '/images/dishes/bbq-wings.webp' },
  { id: 'item_veg_spring_rolls', name: 'Veg Spring Rolls (4 pc)', category: 'starters', price: 109, veg: true, desc: 'Crisp rolls stuffed with glass noodles and vegetables.', imageUrl: '/images/dishes/spring-rolls.webp' },
  { id: 'item_chicken_nuggets', name: 'Chicken Nuggets (8 pc)', category: 'side-dishes', price: 139, veg: false, desc: 'Golden nuggets with smoky BBQ dip.', imageUrl: '/images/dishes/chicken-nuggets.webp' },
  { id: 'item_loaded_nachos', name: 'Loaded Nachos', category: 'starters', price: 159, veg: true, desc: 'Corn nachos loaded with cheese, salsa and jalapeños.', imageUrl: '/images/dishes/loaded-nachos.webp' },
  { id: 'item_cold_coffee', name: 'Cold Coffee', category: 'beverages', price: 89, veg: true, desc: 'Frosty blended coffee with cream.', imageUrl: '/images/dishes/cold-coffee-frappe.webp', isBestseller: true },
  { id: 'item_fresh_lime_soda', name: 'Fresh Lime Soda', category: 'beverages', price: 59, veg: true, desc: 'Zesty lime soda, sweet or salted.', imageUrl: '/images/dishes/fresh-lime-soda.webp' },
  { id: 'item_choco_lava_shake', name: 'Choco Lava Shake', category: 'beverages', price: 149, veg: true, desc: 'Thick chocolate shake with molten core.', imageUrl: '/images/dishes/choco-lava-shake.webp' },
  { id: 'item_chocolate_brownie', name: 'Chocolate Brownie', category: 'desserts', price: 119, veg: true, desc: 'Warm fudgy brownie with a scoop of vanilla.', imageUrl: '/images/dishes/molten-brownie.webp' },
  { id: 'item_grilled_chicken_combo', name: 'Grilled Chicken Combo', category: 'main-course', price: 299, veg: false, desc: 'Grilled chicken, peri fries, drink and a brownie.', imageUrl: '/images/dishes/grilled-chicken-combo.webp' },
  { id: 'item_veg_meal_combo', name: 'Veg Meal Combo', category: 'main-course', price: 249, veg: true, desc: 'Veg burger, masala fries, drink and a brownie.', imageUrl: '/images/dishes/3.webp' },
  { id: 'item_calamari', name: 'Crispy Calamari', category: 'seafood', price: 290, veg: false, desc: 'Golden crispy calamari rings with lemon zest and a zesty garlic aioli.', imageUrl: '/images/dishes/calamari.webp', badge: 'Now Available' },
  { id: 'item_scallops', name: 'Seared Scallops', category: 'seafood', price: 280, veg: false, desc: 'Butter-seared scallops with herb butter, microgreens and lemon beurre blanc.', imageUrl: '/images/dishes/scallops.webp', badge: 'Top Choice' },
  { id: 'item_prawn_tempura', name: 'Prawn Tempura', category: 'seafood', price: 350, veg: false, desc: 'Crispy prawn tempura with a tangy soy-dashi dipping sauce.', imageUrl: '/images/dishes/prawn-tempura.webp', badge: 'New Flavors' },
  { id: 'item_grilled_fish', name: 'Grilled Lemon Butter Fish', category: 'seafood', price: 420, veg: false, desc: 'Pan-grilled basa fillet with lemon butter, herbs and charred seasonal vegetables.', imageUrl: '/images/dishes/grilled-fish.webp' },
  { id: 'item_stuffed_peppers', name: 'Stuffed Bell Peppers', category: 'vegetarian', price: 329, veg: true, desc: 'Roasted bell peppers filled with herbed rice, vegetables and melted cheese.', imageUrl: '/images/dishes/stuffed-peppers.webp' },
  { id: 'item_chickpea_curry', name: 'Chickpea & Potato Curry', category: 'vegetarian', price: 279, veg: true, desc: 'Hearty chana masala with soft potatoes, onions, tomatoes and warm spices.', imageUrl: '/images/dishes/chickpea-curry.webp' },
  { id: 'item_eggplant_parmesan', name: 'Eggplant Parmesan', category: 'vegetarian', price: 403, veg: true, desc: 'Baked eggplant layered with tomato sauce, mozzarella and crispy breadcrumbs.', imageUrl: '/images/dishes/eggplant-parmesan.webp' },
  { id: 'item_veg_chili', name: 'Vegetarian Chili', category: 'vegetarian', price: 370, veg: true, desc: 'Rich three-bean chili with smoky spices, corn and a dollop of sour cream.', imageUrl: '/images/dishes/veg-chili.webp' },
  { id: 'item_acorn_squash', name: 'Stuffed Acorn Squash', category: 'vegetarian', price: 280, veg: true, desc: 'Baked acorn squash filled with wild rice, cranberries, pecans and herbs.', imageUrl: '/images/dishes/acorn-squash.webp' },
  { id: 'item_lentil_soup', name: 'Lentil Soup', category: 'soups', price: 509, veg: true, desc: 'Slow-simmered red lentil soup with cumin, lemon and fresh coriander.', imageUrl: '/images/dishes/lentil-soup.webp' },
  { id: 'item_butternut_squash_soup', name: 'Roasted Butternut Squash Soup', category: 'soups', price: 341, veg: true, desc: 'Silky roasted butternut squash soup with a cream swirl and toasted seeds.', imageUrl: '/images/dishes/butternut-squash-soup.webp', badge: 'New Arrivals' },
  { id: 'item_tomato_basil_soup', name: 'Tomato Basil Soup', category: 'soups', price: 199, veg: true, desc: 'Classic roasted tomato soup with fresh basil and a parmesan crisp.', imageUrl: '/images/dishes/tomato-basil-soup.webp' },
  { id: 'item_cream_mushroom_soup', name: 'Cream of Mushroom Soup', category: 'soups', price: 229, veg: true, desc: 'Velvety mushroom soup with garlic, thyme and a swirl of cream.', imageUrl: '/images/dishes/cream-mushroom-soup.webp' },
  { id: 'item_ribeye', name: 'Grilled Ribeye Steak', category: 'grilled-meat', price: 879, veg: false, desc: 'Perfectly grilled ribeye with herb butter, roasted tomatoes and charred greens.', imageUrl: '/images/dishes/ribeye.webp', isBestseller: true },
  { id: 'item_tandoori_chicken', name: 'Tandoori Chicken', category: 'grilled-meat', price: 399, veg: false, desc: 'Char-grilled chicken marinated in yoghurt, ginger, garlic and tandoori spices.', imageUrl: '/images/dishes/tandoori-chicken.webp' },
  { id: 'item_bbq_wings', name: 'BBQ Chicken Wings', category: 'grilled-meat', price: 349, veg: false, desc: 'Sticky-sweet smoked BBQ wings with a spicy glaze and sesame garnish.', imageUrl: '/images/dishes/bbq-wings.webp' },
  { id: 'item_lamb_chops', name: 'Grilled Lamb Chops', category: 'grilled-meat', price: 699, veg: false, desc: 'Herb-crusted lamb chops grilled to order with mint jus and roasted garlic.', imageUrl: '/images/dishes/lamb-chops.webp' },
  { id: 'item_caesar_salad', name: 'Caesar Salad', category: 'salads', price: 470, veg: true, desc: 'Crisp romaine, garlic croutons, shaved parmesan and classic Caesar dressing.', imageUrl: '/images/dishes/caesar-salad.webp' },
  { id: 'item_quinoa_salad', name: 'Mediterranean Quinoa Salad', category: 'salads', price: 449, veg: true, desc: 'Quinoa with tomatoes, cucumber, feta, olives and a lemon-herb vinaigrette.', imageUrl: '/images/dishes/quinoa-salad.webp' },
  { id: 'item_greek_wraps', name: 'Greek Salad Wraps', category: 'salads', price: 255, veg: true, desc: 'Fresh vegetables, feta and olives wrapped with a zesty Greek dressing.', imageUrl: '/images/dishes/greek-wraps.webp' },
  { id: 'item_garden_salad', name: 'Fresh Garden Salad', category: 'salads', price: 299, veg: true, desc: 'Mixed greens, cherry tomatoes, cucumber, carrot ribbons and balsamic glaze.', imageUrl: '/images/dishes/garden-salad.webp' },
  { id: 'item_butter_chicken_biryani', name: 'Butter Chicken Biryani', category: 'speciality', price: 389, veg: false, desc: 'Fragrant basmati layered with creamy butter chicken, fried onions and saffron.', imageUrl: '/images/dishes/butter-chicken-biryani.webp', isBestseller: true },
  { id: 'item_paneer_biryani', name: 'Paneer Tikka Biryani', category: 'speciality', price: 349, veg: true, desc: 'Smoky paneer tikka layered with basmati, mint and a saffron-milk finish.', imageUrl: '/images/dishes/paneer-biryani.webp' },
  { id: 'item_dal_makhani', name: 'Dal Makhani', category: 'speciality', price: 279, veg: true, desc: 'Black lentils simmered overnight with butter, cream and aromatic spices.', imageUrl: '/images/dishes/dal-makhani.webp' },
  { id: 'item_rogan_josh', name: 'Rogan Josh', category: 'speciality', price: 429, veg: false, desc: 'Kashmiri-style slow-cooked lamb curry with whole spices and yoghurt.', imageUrl: '/images/dishes/rogan-josh.webp' },
  { id: 'item_ravioli', name: 'Spinach & Ricotta Ravioli', category: 'pasta', price: 357, veg: true, desc: 'Handmade ravioli with a creamy herb sauce and shaved parmesan.', imageUrl: '/images/dishes/ravioli.webp' },
  { id: 'item_zucchini_pesto', name: 'Zucchini Noodles with Pesto', category: 'pasta', price: 180, veg: true, desc: 'Fresh zucchini ribbons tossed in basil pesto, pine nuts and cherry tomatoes.', imageUrl: '/images/dishes/zucchini-pesto.webp' },
  { id: 'item_penne_arrabbiata', name: 'Penne Arrabbiata', category: 'pasta', price: 319, veg: true, desc: 'Penne tossed in a fiery tomato-chilli sauce with garlic and basil.', imageUrl: '/images/dishes/penne-arrabbiata.webp' },
  { id: 'item_alfredo_pasta', name: 'Creamy Alfredo Pasta', category: 'pasta', price: 379, veg: true, desc: 'Fettuccine in a silky parmesan cream sauce with grilled mushrooms.', imageUrl: '/images/dishes/alfredo-pasta.webp' },
];

async function main() {
  const btm = await prisma.branch.upsert({
    where: { id: 'br_btm_layout' },
    update: { servicePincodes: PIN_BTM },
    create: {
      id: 'br_btm_layout',
      name: 'BTM Layout',
      city: 'Bengaluru',
      address: '100 Ft Ring Road, BTM 2nd Stage',
      servicePincodes: PIN_BTM,
    },
  });

  const indiranagar = await prisma.branch.upsert({
    where: { id: 'br_indiranagar' },
    update: { servicePincodes: PIN_INDIRANAGAR },
    create: {
      id: 'br_indiranagar',
      name: 'Indiranagar',
      city: 'Bengaluru',
      address: '100 Feet Road, Indiranagar',
      servicePincodes: PIN_INDIRANAGAR,
    },
  });

  for (const m of MENU) {
    await prisma.menuItem.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        description: m.desc,
        category: m.category,
        basePrice: m.price,
        isVeg: m.veg,
        imageUrl: m.imageUrl,
        isBestseller: m.isBestseller ?? false,
        badge: m.badge ?? null,
        isAvailable: true,
      },
      create: {
        id: m.id,
        name: m.name,
        description: m.desc,
        category: m.category,
        basePrice: m.price,
        isVeg: m.veg,
        imageUrl: m.imageUrl,
        isBestseller: m.isBestseller ?? false,
        badge: m.badge ?? null,
        rating: 4.5,
        isAvailable: true,
      },
    });
  }

  const overrides = [
    { branchId: btm.id, itemId: 'item_classic_chicken_burger', priceOverride: 159, isAvailable: true },
    { branchId: btm.id, itemId: 'item_loaded_nachos', priceOverride: 149, isAvailable: true },
    { branchId: btm.id, itemId: 'item_choco_lava_shake', priceOverride: null, isAvailable: false },
    { branchId: indiranagar.id, itemId: 'item_peri_peri_fries', priceOverride: 109, isAvailable: true },
    { branchId: indiranagar.id, itemId: 'item_double_decker_burger', priceOverride: 189, isAvailable: true },
  ];

  for (const o of overrides) {
    await prisma.branchMenuOverride.upsert({
      where: { branchId_itemId: { branchId: o.branchId, itemId: o.itemId } },
      update: {
        priceOverride: o.priceOverride,
        isAvailable: o.isAvailable,
      },
      create: o,
    });
  }

  console.log(`Production menu seed complete. Items: ${await prisma.menuItem.count()}`);
}

main()
  .catch((error) => {
    console.error('Production menu seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
