import OpenAI from "openai";
import { AI_API_KEY } from "../../config.js";

const openai = new OpenAI({
  apiKey: AI_API_KEY,
});

const API_KEY = process.env.API_KEY?.trim() ?? "";
const BASE_URL = "https://hub.ag3nts.org";

// Lista podejrzanych z poprzedniego zadania
const suspects = [
  { name: "Cezary", surname: "Żurek", birthYear: 1987 },
  { name: "Jacek", surname: "Nowak", birthYear: 1991 },
  { name: "Oskar", surname: "Sieradzki", birthYear: 1993 },
  { name: "Wojciech", surname: "Bielik", birthYear: 1986 },
  { name: "Wacław", surname: "Jasiński", birthYear: 1986 },
];

// Funkcja do pobierania listy elektrowni
async function getPowerPlants() {
  const response = await fetch(
    `${BASE_URL}/data/${API_KEY}/findhim_locations.json`
  );
  return await response.json();
}

// Funkcja do pobierania lokalizacji osoby
async function getPersonLocations(name, surname) {
  const response = await fetch(`${BASE_URL}/api/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: API_KEY,
      name,
      surname,
    }),
  });
  return await response.json();
}

// Funkcja do pobierania poziomu dostępu
async function getAccessLevel(name, surname, birthYear) {
  const response = await fetch(`${BASE_URL}/api/accesslevel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: API_KEY,
      name,
      surname,
      birthYear,
    }),
  });
  return await response.json();
}

// Funkcja do wysyłania odpowiedzi
async function submitAnswer(answer) {
  const response = await fetch(`${BASE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: API_KEY,
      task: "findhim",
      answer,
    }),
  });
  return await response.json();
}

// Wzór Haversine do obliczania odległości między dwoma punktami na Ziemi
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Promień Ziemi w km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Odległość w km
}

// Funkcja do uzyskania współrzędnych miast przez LLM
async function getCityCoordinates(cityNames) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Jesteś ekspertem od geografii Polski. Zwróć współrzędne geograficzne (latitude, longitude) dla podanych polskich miast.
Odpowiedz TYLKO w formacie JSON bez dodatkowych komentarzy.`,
      },
      {
        role: "user",
        content: `Podaj współrzędne geograficzne dla następujących polskich miast: ${cityNames.join(
          ", "
        )}.
Odpowiedź w formacie JSON:
{
  "NazwaMiasta": {"lat": wartość, "lon": wartość},
  ...
}`,
      },
    ],
    temperature: 0,
  });

  const content = response.choices[0].message.content;
  // Usuń możliwe markdown formatowanie
  const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  return JSON.parse(jsonStr);
}

// Główna funkcja
async function solve() {
  console.log("🚀 Rozwiązywanie zadania findhim...\n");

  // 1. Pobierz listę elektrowni
  console.log("📍 Krok 1: Pobieranie listy elektrowni...");
  const powerPlantsData = await getPowerPlants();
  console.log("Dane elektrowni:", JSON.stringify(powerPlantsData, null, 2));

  // 2. Przekształć nazwy miast elektrowni na współrzędne
  console.log("\n📍 Krok 2: Uzyskiwanie współrzędnych elektrowni...");
  const cityNames = Object.keys(powerPlantsData.power_plants);
  const cityCoordinates = await getCityCoordinates(cityNames);
  console.log("Współrzędne miast:", JSON.stringify(cityCoordinates, null, 2));

  // 3. Przygotuj listę elektrowni ze współrzędnymi
  const powerPlants = cityNames.map((city) => ({
    city,
    code: powerPlantsData.power_plants[city].code,
    lat: cityCoordinates[city].lat,
    lon: cityCoordinates[city].lon,
    isActive: powerPlantsData.power_plants[city].is_active,
  }));

  console.log("\n📍 Krok 3: Lista elektrowni ze współrzędnymi:");
  powerPlants.forEach((plant) => {
    console.log(
      `  ${plant.city} (${plant.code}): ${plant.lat}, ${plant.lon} [${
        plant.isActive ? "aktywna" : "nieaktywna"
      }]`
    );
  });

  // 4. Dla każdej podejrzanej osoby znajdź najbliższą elektrownię
  console.log("\n📍 Krok 4: Analiza lokalizacji podejrzanych...\n");
  const results = [];

  for (const suspect of suspects) {
    console.log(`\n👤 Sprawdzam: ${suspect.name} ${suspect.surname}`);

    // Pobierz lokalizacje osoby
    const locations = await getPersonLocations(suspect.name, suspect.surname);
    console.log(`   Znaleziono ${locations.length} lokalizacji`);

    // Znajdź najbliższą elektrownię
    let minDistance = Infinity;
    let closestPlant = null;

    for (const location of locations) {
      for (const plant of powerPlants) {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          plant.lat,
          plant.lon
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestPlant = {
            ...plant,
            personLat: location.latitude,
            personLon: location.longitude,
          };
        }
      }
    }

    // Pobierz poziom dostępu
    const accessData = await getAccessLevel(
      suspect.name,
      suspect.surname,
      suspect.birthYear
    );

    const result = {
      name: suspect.name,
      surname: suspect.surname,
      birthYear: suspect.birthYear,
      accessLevel: accessData.accessLevel,
      closestPlant: closestPlant.city,
      powerPlantCode: closestPlant.code,
      distance: minDistance,
      location: `${closestPlant.personLat}, ${closestPlant.personLon}`,
    };

    results.push(result);

    console.log(`   ✓ Najbliższa elektrownia: ${closestPlant.city}`);
    console.log(`   ✓ Kod elektrowni: ${closestPlant.code}`);
    console.log(`   ✓ Odległość: ${minDistance.toFixed(2)} km`);
    console.log(`   ✓ Poziom dostępu: ${accessData.accessLevel}`);
  }

  // 5. Znajdź osobę z najmniejszą odległością
  console.log("\n\n📊 PODSUMOWANIE:");
  console.log("=" .repeat(80));
  results.sort((a, b) => a.distance - b.distance);

  results.forEach((result, index) => {
    console.log(
      `${index + 1}. ${result.name} ${result.surname} - ${result.distance.toFixed(
        2
      )} km od ${result.closestPlant} (${
        result.powerPlantCode
      }), dostęp: ${result.accessLevel}`
    );
  });

  const winner = results[0];
  console.log("\n🎯 PODEJRZANY:");
  console.log(`   Imię: ${winner.name}`);
  console.log(`   Nazwisko: ${winner.surname}`);
  console.log(`   Elektrownia: ${winner.closestPlant}`);
  console.log(`   Kod: ${winner.powerPlantCode}`);
  console.log(`   Odległość: ${winner.distance.toFixed(2)} km`);
  console.log(`   Poziom dostępu: ${winner.accessLevel}`);
  console.log(`   Lokalizacja osoby: ${winner.location}`);

  // 6. Wysyłam odpowiedź
  console.log("\n📤 Wysyłanie odpowiedzi...");
  const answer = {
    name: winner.name,
    surname: winner.surname,
    accessLevel: winner.accessLevel,
    powerPlant: winner.powerPlantCode,
  };

  console.log("Odpowiedź:", JSON.stringify(answer, null, 2));

  const submitResult = await submitAnswer(answer);
  console.log("\n✅ Odpowiedź z serwera:");
  console.log(JSON.stringify(submitResult, null, 2));

  if (submitResult.code === 0) {
    console.log("\n🎉 SUKCES! Flaga:", submitResult.message);
  } else {
    console.log("\n❌ BŁĄD:", submitResult.message);
  }
}

// Uruchomienie
solve().catch((error) => {
  console.error("❌ Błąd:", error);
  process.exit(1);
});
