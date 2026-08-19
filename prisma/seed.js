// Dev-only seed data: branches, RBAC users, the master menu catalog,
// per-branch price/availability overrides and a couple of saved addresses.
//
//   npx prisma db seed
//
// Test credentials (dev only — rotate before any shared environment):
//   super_admin    super_admin@snackpod.local / SuperAdmin@123!
//   branch_admin   branch_admin@snackpod.local / BranchAdmin@123!
//   customer       customer@snackpod.local     / Customer@123!

const { PrismaClient, Role } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');

const prisma = new PrismaClient();

const PIN_BTM = JSON.stringify(['560076', '560078', '560103']);
const PIN_INDIRANAGAR = JSON.stringify(['560038', '560075', '560008']);

// ── Master catalog ──────────────────────────────────────────────────────────
// Prices are whole rupees (int), matching the app's existing ₹ pricing.
// imageUrl maps each item to the closest file in public/images/dishes/ (items
// without a reasonable match keep null — listed in the Phase 2 summary).
// isBestseller carries over from the old hardcoded menu-data.ts list so the
// "★ Bestseller" badges stay visible after the UI cutover.
const MENU = [
  { id: 'item_classic_chicken_burger', name: 'Classic Chicken Burger', category: 'burgers', price: 149, veg: false, desc: 'Crispy fried chicken, lettuce, house mayo in a toasted bun.', imageUrl: '/images/dishes/zinger-burger.webp' },
  { id: 'item_crispy_veg_burger', name: 'Crispy Veg Burger', category: 'burgers', price: 119, veg: true, desc: 'Crunchy veg patty with fresh veggies and tangy sauce.', imageUrl: '/images/dishes/veggie-burger.webp' },
  { id: 'item_double_decker_burger', name: 'Double Decker Burger', category: 'burgers', price: 199, veg: false, desc: 'Two juicy patties, double cheese, pickles and special sauce.', imageUrl: '/images/dishes/bbq-burger.webp' },
  { id: 'item_paneer_tikka_burger', name: 'Paneer Tikka Burger', category: 'burgers', price: 139, veg: true, desc: 'Smoky paneer tikka patty with mint mayo.', imageUrl: '/images/dishes/paneer-tikka.webp' },
  { id: 'item_peri_peri_fries', name: 'Peri Peri Fries', category: 'side-dishes', price: 99, veg: true, desc: 'Crispy fries dusted with fiery peri peri seasoning.', imageUrl: '/images/dishes/peri-peri-fries.webp', isBestseller: true },
  { id: 'item_masala_fries', name: 'Masala Fries', category: 'side-dishes', price: 89, veg: true, desc: 'Fries tossed in Indian spice mix with a side of ketchup.', imageUrl: '/images/dishes/salted-fries.webp' },
  { id: 'item_chicken_wings', name: 'Spicy Chicken Wings (6 pc)', category: 'starters', price: 179, veg: false, desc: 'Sticky-spicy wings with cooling ranch dip.', imageUrl: '/images/dishes/bbq-wings.webp' },
  { id: 'item_veg_spring_rolls', name: 'Veg Spring Rolls (4 pc)', category: 'starters', price: 109, veg: true, desc: 'Crisp rolls stuffed with glass noodles and vegetables.', imageUrl: '/images/dishes/spring-rolls.webp' },
  { id: 'item_chicken_nuggets', name: 'Chicken Nuggets (8 pc)', category: 'side-dishes', price: 139, veg: false, desc: 'Golden nuggets with smoky BBQ dip.', imageUrl: null },
  { id: 'item_loaded_nachos', name: 'Loaded Nachos', category: 'starters', price: 159, veg: true, desc: 'Corn nachos loaded with cheese, salsa and jalapeños.', imageUrl: null },
  { id: 'item_cold_coffee', name: 'Cold Coffee', category: 'beverages', price: 89, veg: true, desc: 'Frosty blended coffee with cream.', imageUrl: '/images/dishes/cold-coffee-frappe.webp', isBestseller: true },
  { id: 'item_fresh_lime_soda', name: 'Fresh Lime Soda', category: 'beverages', price: 59, veg: true, desc: 'Zesty lime soda, sweet or salted.', imageUrl: null },
  { id: 'item_choco_lava_shake', name: 'Choco Lava Shake', category: 'beverages', price: 149, veg: true, desc: 'Thick chocolate shake with molten core.', imageUrl: null },
  { id: 'item_chocolate_brownie', name: 'Chocolate Brownie', category: 'desserts', price: 119, veg: true, desc: 'Warm fudgy brownie with a scoop of vanilla.', imageUrl: '/images/dishes/molten-brownie.webp' },
  { id: 'item_grilled_chicken_combo', name: 'Grilled Chicken Combo', category: 'main-course', price: 299, veg: false, desc: 'Grilled chicken, peri fries, drink and a brownie.', imageUrl: null },
  { id: 'item_veg_meal_combo', name: 'Veg Meal Combo', category: 'main-course', price: 249, veg: true, desc: 'Veg burger, masala fries, drink and a brownie.', imageUrl: '/images/dishes/3.webp' },
];

async function main() {
    // ── Branches ────────────────────────────────────────────────────────────
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

    // ── Users (RBAC) ────────────────────────────────────────────────────────
    const passwordHash = (pw) => hash(pw, { algorithm: 2 /* argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 });

    const superAdmin = await prisma.user.upsert({
        where: { email: 'super_admin@snackpod.local' },
        update: {},
        create: {
            email: 'super_admin@snackpod.local',
            name: 'Super Admin',
            passwordHash: await passwordHash('SuperAdmin@123!'),
            phoneVerified: true,
            role: Role.SUPER_ADMIN,
        },
    });

    const branchAdmin = await prisma.user.upsert({
        where: { email: 'branch_admin@snackpod.local' },
        update: {},
        create: {
            email: 'branch_admin@snackpod.local',
            name: 'BTM Admin',
            passwordHash: await passwordHash('BranchAdmin@123!'),
            phoneVerified: true,
            role: Role.BRANCH_ADMIN,
            branchId: btm.id,
        },
    });

    const customer = await prisma.user.upsert({
        where: { email: 'customer@snackpod.local' },
        update: {},
        create: {
            email: 'customer@snackpod.local',
            name: 'Demo Customer',
            passwordHash: await passwordHash('Customer@123!'),
            phoneVerified: true,
            role: Role.CUSTOMER,
        },
    });

    // ── Master menu catalog ─────────────────────────────────────────────────
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
            },
        });
    }

    // ── Per-branch overrides ────────────────────────────────────────────────
    // BTM: classic chicken burger is pricier, loaded nachos cheaper,
    //      choco lava shake unavailable here.
    const btmOverrides = [
        { itemId: 'item_classic_chicken_burger', priceOverride: 159 },
        { itemId: 'item_loaded_nachos', priceOverride: 149 },
        { itemId: 'item_choco_lava_shake', priceOverride: null, isAvailable: false },
    ];
    // Indiranagar: peri fries pricier, double decker cheaper.
    const indiranagarOverrides = [
        { itemId: 'item_peri_peri_fries', priceOverride: 109 },
        { itemId: 'item_double_decker_burger', priceOverride: 189 },
    ];

    for (const branch of [btm, indiranagar]) {
        const overrides = branch.id === btm.id ? btmOverrides : indiranagarOverrides;
        for (const o of overrides) {
            await prisma.branchMenuOverride.upsert({
                where: { branchId_itemId: { branchId: branch.id, itemId: o.itemId } },
                update: {
                    priceOverride: o.priceOverride === undefined ? null : o.priceOverride,
                    isAvailable: o.isAvailable === undefined ? true : o.isAvailable,
                },
                create: {
                    branchId: branch.id,
                    itemId: o.itemId,
                    priceOverride: o.priceOverride === undefined ? null : o.priceOverride,
                    isAvailable: o.isAvailable === undefined ? true : o.isAvailable,
                },
            });
        }
    }

    // ── Saved addresses ─────────────────────────────────────────────────────
    await prisma.address.upsert({
        where: { id: 'addr_customer_home' },
        update: {},
        create: {
            id: 'addr_customer_home',
            userId: customer.id,
            label: 'Home',
            line1: '21st Main, 4th Cross',
            line2: 'BTM 2nd Stage',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560076',
            isDefault: true,
        },
    });
    await prisma.address.upsert({
        where: { id: 'addr_customer_office' },
        update: {},
        create: {
            id: 'addr_customer_office',
            userId: customer.id,
            label: 'Office',
            line1: '321, 100 Feet Road',
            line2: 'Indiranagar',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560038',
            isDefault: false,
        },
    });

    const itemCount = await prisma.menuItem.count();
    const overrideCount = await prisma.branchMenuOverride.count();
    console.log(`Seeded ✓  branches=${btm.name}, ${indiranagar.name} | items=${itemCount} | overrides=${overrideCount}`);
    console.log(`  super_admin : ${superAdmin.email}`);
    console.log(`  branch_admin: ${branchAdmin.email}  (branch=${branchAdmin.branchId})`);
    console.log(`  customer    : ${customer.email}  (2 addresses)`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
