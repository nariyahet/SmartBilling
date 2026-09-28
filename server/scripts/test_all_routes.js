const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const controllersDir = path.join(__dirname, '..', 'controllers');

console.log('--- VERIFYING ALL ROUTES AND CONTROLLERS IMPORT CLEANLY ---');

let errors = 0;

// Test all controllers
const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
for (const file of controllerFiles) {
  try {
    require(path.join(controllersDir, file));
  } catch (err) {
    console.error(`❌ Controller failed to load: ${file}`, err.message);
    errors++;
  }
}

// Test all routes
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
for (const file of routeFiles) {
  try {
    require(path.join(routesDir, file));
  } catch (err) {
    console.error(`❌ Route failed to load: ${file}`, err.message);
    errors++;
  }
}

if (errors === 0) {
  console.log(`✅ All ${controllerFiles.length} controllers and ${routeFiles.length} routes loaded successfully with 0 errors!`);
  process.exit(0);
} else {
  console.error(`❌ Found ${errors} loading errors!`);
  process.exit(1);
}
