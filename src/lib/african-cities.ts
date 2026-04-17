// Central and East African Cities Database
// Includes major cities with coordinates for routing

export interface City {
  name: string;
  country: string;
  region: 'Central' | 'East' | 'Southern';
  lat: number;
  lng: number;
  isMajorHub: boolean;
  cargoTypes: string[]; // Common cargo types for this city
}

export const africanCities: City[] = [
  // TANZANIA - Major Hubs
  { name: 'Dar es Salaam', country: 'Tanzania', region: 'East', lat: -6.7924, lng: 39.2083, isMajorHub: true, cargoTypes: ['General Cargo', 'Containers', 'Perishables'] },
  { name: 'Arusha', country: 'Tanzania', region: 'East', lat: -3.3869, lng: 36.6830, isMajorHub: true, cargoTypes: ['General Cargo', 'Machinery', 'Agricultural'] },
  { name: 'Mwanza', country: 'Tanzania', region: 'East', lat: -2.5167, lng: 32.9000, isMajorHub: true, cargoTypes: ['Fish', 'Agricultural', 'Minerals'] },
  { name: 'Dodoma', country: 'Tanzania', region: 'East', lat: -6.1630, lng: 35.7516, isMajorHub: true, cargoTypes: ['Government Supplies', 'General Cargo'] },
  { name: 'Tanga', country: 'Tanzania', region: 'East', lat: -5.0667, lng: 39.1000, isMajorHub: true, cargoTypes: ['Containers', 'Cement', 'Agricultural'] },
  { name: 'Mbeya', country: 'Tanzania', region: 'East', lat: -8.9000, lng: 33.4500, isMajorHub: true, cargoTypes: ['Agricultural', 'Minerals', 'General Cargo'] },
  { name: 'Kilimanjaro', country: 'Tanzania', region: 'East', lat: -3.4000, lng: 37.3500, isMajorHub: true, cargoTypes: ['Coffee', 'Agricultural', 'Tourism Supplies'] },
  { name: 'Morogoro', country: 'Tanzania', region: 'East', lat: -6.8210, lng: 37.6612, isMajorHub: false, cargoTypes: ['Agricultural', 'Sisal'] },
  { name: 'Kigoma', country: 'Tanzania', region: 'East', lat: -4.8833, lng: 29.6333, isMajorHub: false, cargoTypes: ['Fish', 'Transit Cargo'] },
  { name: 'Singida', country: 'Tanzania', region: 'East', lat: -4.8167, lng: 34.7500, isMajorHub: false, cargoTypes: ['Salt', 'Agricultural'] },
  { name: 'Iringa', country: 'Tanzania', region: 'East', lat: -7.7700, lng: 35.6900, isMajorHub: false, cargoTypes: ['Timber', 'Agricultural'] },
  { name: 'Lindi', country: 'Tanzania', region: 'East', lat: -9.9833, lng: 39.7167, isMajorHub: false, cargoTypes: ['Sesame', 'Cassava'] },
  { name: 'Mtwara', country: 'Tanzania', region: 'East', lat: -10.2667, lng: 40.1833, isMajorHub: true, cargoTypes: ['Cement', 'General Cargo', 'Gas'] },
  { name: 'Musoma', country: 'Tanzania', region: 'East', lat: -1.5000, lng: 33.8000, isMajorHub: false, cargoTypes: ['Fish', 'Agricultural'] },
  { name: 'Shinyanga', country: 'Tanzania', region: 'East', lat: -3.6633, lng: 33.4211, isMajorHub: false, cargoTypes: ['Gold', 'Cotton'] },
  { name: 'Kahama', country: 'Tanzania', region: 'East', lat: -3.8333, lng: 32.6000, isMajorHub: false, cargoTypes: ['Gold', 'Agricultural'] },
  { name: 'Sumbawanga', country: 'Tanzania', region: 'East', lat: -7.9667, lng: 31.6167, isMajorHub: false, cargoTypes: ['Agricultural'] },
  { name: 'Bukoba', country: 'Tanzania', region: 'East', lat: -1.3333, lng: 31.8167, isMajorHub: false, cargoTypes: ['Coffee', 'Bananas'] },
  { name: 'Mpanda', country: 'Tanzania', region: 'East', lat: -6.3500, lng: 31.0500, isMajorHub: false, cargoTypes: ['Gold', 'Agricultural'] },
  { name: 'Tunduma', country: 'Tanzania', region: 'East', lat: -9.3000, lng: 32.7667, isMajorHub: true, cargoTypes: ['Transit Cargo', 'General Cargo'] },
  { name: 'Namanga', country: 'Tanzania', region: 'East', lat: -2.5500, lng: 36.7833, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Livestock'] },
  { name: 'Horohoro', country: 'Tanzania', region: 'East', lat: -4.7667, lng: 37.6667, isMajorHub: true, cargoTypes: ['Transit Cargo'] },
  
  // KENYA - Major Hubs
  { name: 'Nairobi', country: 'Kenya', region: 'East', lat: -1.2921, lng: 36.8219, isMajorHub: true, cargoTypes: ['General Cargo', 'Containers', 'Manufactured Goods'] },
  { name: 'Mombasa', country: 'Kenya', region: 'East', lat: -4.0435, lng: 39.6682, isMajorHub: true, cargoTypes: ['Containers', 'General Cargo', 'Petroleum'] },
  { name: 'Kisumu', country: 'Kenya', region: 'East', lat: -0.1022, lng: 34.7617, isMajorHub: true, cargoTypes: ['Fish', 'Agricultural', 'Manufactured'] },
  { name: 'Nakuru', country: 'Kenya', region: 'East', lat: -0.3031, lng: 36.0800, isMajorHub: true, cargoTypes: ['Agricultural', 'Manufactured Goods'] },
  { name: 'Eldoret', country: 'Kenya', region: 'East', lat: 0.5143, lng: 35.2698, isMajorHub: true, cargoTypes: ['Agricultural', 'Manufactured Goods'] },
  { name: 'Malaba', country: 'Kenya', region: 'East', lat: 0.6333, lng: 34.2833, isMajorHub: true, cargoTypes: ['Transit Cargo'] },
  { name: 'Busia', country: 'Kenya', region: 'East', lat: 0.4608, lng: 34.1115, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Agricultural'] },
  { name: 'Garissa', country: 'Kenya', region: 'East', lat: -0.4530, lng: 39.6406, isMajorHub: false, cargoTypes: ['Livestock', 'General Cargo'] },
  { name: 'Thika', country: 'Kenya', region: 'East', lat: -1.0333, lng: 37.0667, isMajorHub: false, cargoTypes: ['Manufactured Goods', 'Agricultural'] },
  { name: 'Machakos', country: 'Kenya', region: 'East', lat: -1.5167, lng: 37.2667, isMajorHub: false, cargoTypes: ['Agricultural'] },
  { name: 'Kericho', country: 'Kenya', region: 'East', lat: -0.3667, lng: 35.2833, isMajorHub: false, cargoTypes: ['Tea', 'Agricultural'] },
  { name: 'Kitale', country: 'Kenya', region: 'East', lat: 1.0167, lng: 35.0000, isMajorHub: false, cargoTypes: ['Maize', 'Agricultural'] },
  
  // UGANDA - Major Hubs
  { name: 'Kampala', country: 'Uganda', region: 'East', lat: 0.3476, lng: 32.5825, isMajorHub: true, cargoTypes: ['General Cargo', 'Manufactured Goods', 'Agricultural'] },
  { name: 'Entebbe', country: 'Uganda', region: 'East', lat: 0.0519, lng: 32.4637, isMajorHub: true, cargoTypes: ['Air Cargo', 'General Cargo'] },
  { name: 'Jinja', country: 'Uganda', region: 'East', lat: 0.4244, lng: 33.2042, isMajorHub: true, cargoTypes: ['Manufactured Goods', 'Agricultural', 'Hydro Equipment'] },
  { name: 'Mbale', country: 'Uganda', region: 'East', lat: 1.0800, lng: 34.1750, isMajorHub: true, cargoTypes: ['Agricultural', 'Coffee'] },
  { name: 'Mbarara', country: 'Uganda', region: 'East', lat: -0.6072, lng: 30.6545, isMajorHub: true, cargoTypes: ['Agricultural', 'Livestock', 'Manufactured'] },
  { name: 'Gulu', country: 'Uganda', region: 'East', lat: 2.7749, lng: 32.2990, isMajorHub: true, cargoTypes: ['Agricultural', 'General Cargo'] },
  { name: 'Arua', country: 'Uganda', region: 'East', lat: 3.0206, lng: 30.9111, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Agricultural'] },
  { name: 'Fort Portal', country: 'Uganda', region: 'East', lat: 0.6710, lng: 30.2741, isMajorHub: false, cargoTypes: ['Tourism', 'Agricultural'] },
  { name: 'Lira', country: 'Uganda', region: 'East', lat: 2.2500, lng: 32.9167, isMajorHub: false, cargoTypes: ['Agricultural'] },
  { name: 'Masaka', country: 'Uganda', region: 'East', lat: -0.3333, lng: 31.7333, isMajorHub: false, cargoTypes: ['Agricultural', 'Livestock'] },
  { name: 'Tororo', country: 'Uganda', region: 'East', lat: 0.6500, lng: 34.0667, isMajorHub: true, cargoTypes: ['Cement', 'Agricultural'] },
  { name: 'Malaba', country: 'Uganda', region: 'East', lat: 0.6000, lng: 34.2833, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Customs'] },
  
  // RWANDA - Major Hubs
  { name: 'Kigali', country: 'Rwanda', region: 'East', lat: -1.9706, lng: 30.1044, isMajorHub: true, cargoTypes: ['General Cargo', 'Manufactured Goods', 'Agricultural'] },
  { name: 'Musanze', country: 'Rwanda', region: 'East', lat: -1.5000, lng: 29.6000, isMajorHub: false, cargoTypes: ['Tourism', 'Agricultural'] },
  { name: 'Rubavu', country: 'Rwanda', region: 'East', lat: -1.6667, lng: 29.3500, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Border Trade'] },
  { name: 'Huye', country: 'Rwanda', region: 'East', lat: -2.6000, lng: 29.7333, isMajorHub: false, cargoTypes: ['Agricultural', 'Education'] },
  { name: 'Nyagatare', country: 'Rwanda', region: 'East', lat: -1.3000, lng: 30.3333, isMajorHub: false, cargoTypes: ['Livestock', 'Agricultural'] },
  { name: 'Rwanda Border (Rusumo)', country: 'Rwanda', region: 'East', lat: -2.3833, lng: 30.7833, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Border Trade'] },
  
  // BURUNDI - Major Hubs
  { name: 'Bujumbura', country: 'Burundi', region: 'East', lat: -3.3818, lng: 29.3622, isMajorHub: true, cargoTypes: ['General Cargo', 'Transit', 'Agricultural'] },
  { name: 'Gitega', country: 'Burundi', region: 'East', lat: -3.4275, lng: 29.9246, isMajorHub: true, cargoTypes: ['Government', 'Agricultural'] },
  { name: 'Ngozi', country: 'Burundi', region: 'East', lat: -2.9000, lng: 29.8333, isMajorHub: false, cargoTypes: ['Agricultural', 'Coffee'] },
  { name: 'Rumonge', country: 'Burundi', region: 'East', lat: -3.9667, lng: 29.4333, isMajorHub: false, cargoTypes: ['Fish', 'Agricultural'] },
  
  // DRC (Democratic Republic of Congo) - Central/East
  { name: 'Lubumbashi', country: 'DRC', region: 'Central', lat: -11.6876, lng: 27.5026, isMajorHub: true, cargoTypes: ['Minerals', 'Copper', 'Cobalt', 'General Cargo'] },
  { name: 'Kinshasa', country: 'DRC', region: 'Central', lat: -4.4419, lng: 15.2663, isMajorHub: true, cargoTypes: ['General Cargo', 'Manufactured Goods', 'Food'] },
  { name: 'Goma', country: 'DRC', region: 'East', lat: -1.6585, lng: 29.2203, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Humanitarian', 'General Cargo'] },
  { name: 'Bukavu', country: 'DRC', region: 'East', lat: -2.5123, lng: 28.8480, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Agricultural', 'Minerals'] },
  { name: 'Kolwezi', country: 'DRC', region: 'Central', lat: -10.7167, lng: 25.4667, isMajorHub: true, cargoTypes: ['Copper', 'Cobalt', 'Minerals'] },
  { name: 'Likasi', country: 'DRC', region: 'Central', lat: -10.9833, lng: 26.7333, isMajorHub: false, cargoTypes: ['Minerals', 'Manufacturing'] },
  { name: 'Kalemie', country: 'DRC', region: 'Central', lat: -5.9475, lng: 29.1947, isMajorHub: true, cargoTypes: ['Fish', 'Transit Cargo'] },
  { name: 'Uvira', country: 'DRC', region: 'East', lat: -3.3953, lng: 29.1376, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Fish', 'Agricultural'] },
  { name: 'Beni', country: 'DRC', region: 'East', lat: 0.5000, lng: 29.4667, isMajorHub: true, cargoTypes: ['Agricultural', 'Transit Cargo'] },
  { name: 'Butembo', country: 'DRC', region: 'East', lat: 0.1500, lng: 29.2833, isMajorHub: true, cargoTypes: ['Trade', 'Agricultural', 'Transit'] },
  
  // ZAMBIA - Southern/Central
  { name: 'Lusaka', country: 'Zambia', region: 'Southern', lat: -15.3875, lng: 28.3228, isMajorHub: true, cargoTypes: ['General Cargo', 'Manufactured Goods', 'Agricultural'] },
  { name: 'Ndola', country: 'Zambia', region: 'Southern', lat: -12.9698, lng: 28.6366, isMajorHub: true, cargoTypes: ['Copper', 'Manufacturing', 'Agricultural'] },
  { name: 'Kitwe', country: 'Zambia', region: 'Southern', lat: -12.8024, lng: 28.2132, isMajorHub: true, cargoTypes: ['Copper', 'Manufacturing'] },
  { name: 'Livingstone', country: 'Zambia', region: 'Southern', lat: -17.8532, lng: 25.8560, isMajorHub: true, cargoTypes: ['Tourism', 'Border Trade', 'Agricultural'] },
  { name: 'Chipata', country: 'Zambia', region: 'Southern', lat: -13.6333, lng: 32.6500, isMajorHub: true, cargoTypes: ['Agricultural', 'Transit Cargo'] },
  { name: 'Kasumbalesa', country: 'Zambia', region: 'Southern', lat: -12.2000, lng: 27.7667, isMajorHub: true, cargoTypes: ['Copper', 'Transit Cargo', 'Border Trade'] },
  
  // MALAWI - East/Southern
  { name: 'Lilongwe', country: 'Malawi', region: 'East', lat: -13.9626, lng: 33.7741, isMajorHub: true, cargoTypes: ['General Cargo', 'Government', 'Agricultural'] },
  { name: 'Blantyre', country: 'Malawi', region: 'East', lat: -15.7861, lng: 35.0058, isMajorHub: true, cargoTypes: ['Manufacturing', 'Agricultural', 'Tea'] },
  { name: 'Mzuzu', country: 'Malawi', region: 'East', lat: -11.4650, lng: 34.0203, isMajorHub: true, cargoTypes: ['Coffee', 'Agricultural', 'Tourism'] },
  { name: 'Zomba', country: 'Malawi', region: 'East', lat: -15.3833, lng: 35.3333, isMajorHub: false, cargoTypes: ['Agricultural', 'Education'] },
  { name: 'Kasungu', country: 'Malawi', region: 'East', lat: -13.0333, lng: 33.4833, isMajorHub: false, cargoTypes: ['Tobacco', 'Agricultural'] },
  { name: 'Mchinji', country: 'Malawi', region: 'East', lat: -13.8167, lng: 32.9000, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Agricultural'] },
  
  // MOZAMBIQUE - East/Southern
  { name: 'Maputo', country: 'Mozambique', region: 'Southern', lat: -25.9692, lng: 32.5732, isMajorHub: true, cargoTypes: ['Containers', 'Coal', 'General Cargo'] },
  { name: 'Beira', country: 'Mozambique', region: 'Southern', lat: -19.8436, lng: 34.8389, isMajorHub: true, cargoTypes: ['Containers', 'Agricultural', 'Transit'] },
  { name: 'Nampula', country: 'Mozambique', region: 'Southern', lat: -15.1265, lng: 39.2666, isMajorHub: true, cargoTypes: ['Agricultural', 'Minerals'] },
  { name: 'Tete', country: 'Mozambique', region: 'Southern', lat: -16.1564, lng: 33.5867, isMajorHub: true, cargoTypes: ['Coal', 'Minerals', 'Agricultural'] },
  { name: 'Nacala', country: 'Mozambique', region: 'Southern', lat: -14.5626, lng: 40.6854, isMajorHub: true, cargoTypes: ['Coal', 'Containers', 'Agricultural'] },
  { name: 'Pemba', country: 'Mozambique', region: 'Southern', lat: -12.9732, lng: 40.5178, isMajorHub: false, cargoTypes: ['Tourism', 'Agricultural'] },
  { name: 'Machipanda', country: 'Mozambique', region: 'Southern', lat: -19.2500, lng: 33.1000, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Border Trade'] },
  
  // SOUTH SUDAN - East
  { name: 'Juba', country: 'South Sudan', region: 'East', lat: 4.8594, lng: 31.5713, isMajorHub: true, cargoTypes: ['General Cargo', 'Humanitarian', 'Oil'] },
  { name: 'Malakal', country: 'South Sudan', region: 'East', lat: 9.5369, lng: 31.6576, isMajorHub: true, cargoTypes: ['Agricultural', 'Transit'] },
  { name: 'Wau', country: 'South Sudan', region: 'East', lat: 7.7000, lng: 28.0000, isMajorHub: true, cargoTypes: ['Agricultural', 'General Cargo'] },
  { name: 'Nimule', country: 'South Sudan', region: 'East', lat: 3.6000, lng: 32.0500, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Border Trade'] },
  { name: 'Kaya', country: 'South Sudan', region: 'East', lat: 3.5000, lng: 30.7500, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Border Trade'] },
  
  // ETHIOPIA - East
  { name: 'Addis Ababa', country: 'Ethiopia', region: 'East', lat: 9.0084, lng: 38.7575, isMajorHub: true, cargoTypes: ['General Cargo', 'Manufactured Goods', 'Agricultural'] },
  { name: 'Dire Dawa', country: 'Ethiopia', region: 'East', lat: 9.6000, lng: 41.8667, isMajorHub: true, cargoTypes: ['Transit Cargo', 'Manufactured Goods'] },
  { name: 'Moyale', country: 'Ethiopia', region: 'East', lat: 3.5333, lng: 39.0500, isMajorHub: true, cargoTypes: ['Livestock', 'Border Trade'] },
  { name: 'Hawassa', country: 'Ethiopia', region: 'East', lat: 7.0500, lng: 38.4667, isMajorHub: true, cargoTypes: ['Manufacturing', 'Agricultural'] },
  { name: 'Mekelle', country: 'Ethiopia', region: 'East', lat: 13.4969, lng: 39.4769, isMajorHub: true, cargoTypes: ['Agricultural', 'Manufactured'] },
];

// Get cities by country
export function getCitiesByCountry(country: string): City[] {
  return africanCities.filter(city => city.country === country);
}

// Get cities by region
export function getCitiesByRegion(region: 'Central' | 'East' | 'Southern'): City[] {
  return africanCities.filter(city => city.region === region);
}

// Get major hub cities
export function getMajorHubs(): City[] {
  return africanCities.filter(city => city.isMajorHub);
}

// Search cities by name
export function searchCities(query: string): City[] {
  const lowerQuery = query.toLowerCase();
  return africanCities.filter(city => 
    city.name.toLowerCase().includes(lowerQuery) ||
    city.country.toLowerCase().includes(lowerQuery)
  );
}

// Get city by name
export function getCityByName(name: string): City | undefined {
  return africanCities.find(city => 
    city.name.toLowerCase() === name.toLowerCase()
  );
}

// Get cities suitable for cargo type
export function getCitiesForCargoType(cargoType: string): City[] {
  const normalizedCargo = cargoType.toLowerCase();
  return africanCities.filter(city => 
    city.cargoTypes.some(ct => ct.toLowerCase().includes(normalizedCargo))
  );
}

// Calculate approximate distance between two cities (in km)
export function calculateDistance(city1: City, city2: City): number {
  const R = 6371; // Earth's radius in km
  const dLat = (city2.lat - city1.lat) * Math.PI / 180;
  const dLon = (city2.lng - city1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(city1.lat * Math.PI / 180) * Math.cos(city2.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

// Get estimated driving time in hours
export function getEstimatedTime(city1: City, city2: City): number {
  const distance = calculateDistance(city1, city2);
  // Assume average speed of 60 km/h for trucks on African roads
  return Math.round((distance / 60) * 10) / 10;
}

// Get cargo-specific route recommendations
export function getCargoRouteRecommendation(cargoType: string, origin: City, destination: City): string {
  const normalizedCargo = cargoType.toLowerCase();
  const distance = calculateDistance(origin, destination);
  const baseTime = getEstimatedTime(origin, destination);
  
  let recommendations: string[] = [];
  
  if (normalizedCargo.includes('perishable') || normalizedCargo.includes('frozen') || normalizedCargo.includes('cold')) {
    recommendations.push(`🧊 Use refrigerated truck. Max ${baseTime} hours transit time.`);
    recommendations.push(`⚡ Recommend express route via major highways.`);
  }
  
  if (normalizedCargo.includes('hazardous') || normalizedCargo.includes('dangerous') || normalizedCargo.includes('chemical')) {
    recommendations.push(`⚠️ Hazardous cargo - Check permit requirements for ${origin.country} → ${destination.country}`);
    recommendations.push(`🛡️ Use escort vehicle for this ${distance}km route.`);
  }
  
  if (normalizedCargo.includes('heavy') || normalizedCargo.includes('machinery') || normalizedCargo.includes('equipment')) {
    recommendations.push(`🏗️ Heavy cargo - Verify axle load limits on route.`);
    recommendations.push(`📋 Special permits required. Estimated ${baseTime * 1.5} hours (slower speed).`);
  }
  
  if (normalizedCargo.includes('mineral') || normalizedCargo.includes('copper') || normalizedCargo.includes('cobalt')) {
    recommendations.push(`⛏️ Mining cargo - High security route recommended.`);
    recommendations.push(`💰 Consider insurance for this valuable cargo.`);
  }
  
  if (normalizedCargo.includes('container') || normalizedCargo.includes('general')) {
    recommendations.push(`📦 Standard route via major corridors.`);
    recommendations.push(`⏱️ Estimated ${baseTime} hours normal transit time.`);
  }
  
  if (recommendations.length === 0) {
    return `Standard ${distance}km route from ${origin.name} to ${destination.name}. Estimated ${baseTime} hours.`;
  }
  
  return recommendations.join('\n');
}

export const countries = [...new Set(africanCities.map(c => c.country))].sort();
