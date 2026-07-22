// // Business and Product Catalog
// // This file contains all businesses and their corresponding products

// // BUSINESSES: Building sprites that appear at the top of the screen
// // - label: Unique identifier used in levels.json
// // - fileName: Image file in graphics/businesses/ folder
// // - spriteKey: Key used by Phaser to reference the loaded sprite (auto-derived from fileName if not specified)

// // PRODUCTS: Collectible items that correspond to each business
// // - label: Unique identifier used in levels.json
// // - fileName: Image file in graphics/products/ folder
// // - spriteKey: Key used by Phaser to reference the loaded sprite (auto-derived from fileName if not specified)

// var CATALOG = {
//     BUSINESSES: [
//         {
//             label: "pizza_shop",
//             fileName: "pizza_shop.png"
//         },
//         {
//             label: "library",
//             fileName: "library.png"
//         }
//         // Add more businesses here as you expand
//         // Example:
//         // {
//         //     label: "cafe",
//         //     fileName: "cafe.png"
//         // },
//         // {
//         //     label: "gas_station",
//         //     fileName: "gas_station.png"
//         // }
//     ],
    
//     PRODUCTS: [
//         {
//             label: "pizza",
//             fileName: "pizza.png"
//         },
//         {
//             label: "book",
//             fileName: "book.png"
//         }
//         // Add more products here as you expand
//         // Example:
//         // {
//         //     label: "coffee",
//         //     fileName: "coffee.png"
//         // },
//         // {
//         //     label: "fuel",
//         //     fileName: "fuel.png"
//         // }
//     ]
// };

// // Helper function to get sprite key from fileName (removes extension)
// function getSpriteKey(fileName) {
//     return fileName.replace(/\.(png|jpg|jpeg|svg|webp)$/i, '');
// }

// // Auto-generate spriteKey from fileName if not provided
// CATALOG.BUSINESSES.forEach(business => {
//     if (!business.spriteKey) {
//         business.spriteKey = getSpriteKey(business.fileName);
//     }
// });

// CATALOG.PRODUCTS.forEach(product => {
//     if (!product.spriteKey) {
//         product.spriteKey = getSpriteKey(product.fileName);
//     }
// });
