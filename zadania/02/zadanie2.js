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

// Funkcja do znalezienia najbliższej elektrowni dla danej lokalizacji
function findClosestPowerPlant(lat, lon, powerPlants) {
  let minDistance = Infinity;
  let closestPlant = null;

  for (const plant of powerPlants) {
    const distance = calculateDistance(lat, lon, plant.lat, plant.lon);
    if (distance < minDistance) {
      minDistance = distance;
      closestPlant = { ...plant, distance };
    }
  }

  return closestPlant;
}

// Definicje narzędzi dla Function Calling
const tools = [
  {
    type: "function",
    function: {
      name: "get_power_plants",
      description: "Pobiera listę wszystkich elektrowni atomowych wraz z ich kodami i współrzędnymi",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_person_locations",
      description: "Pobiera listę lokalizacji (współrzędnych), w których widziano daną osobę",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Imię osoby",
          },
          surname: {
            type: "string",
            description: "Nazwisko osoby",
          },
        },
        required: ["name", "surname"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_closest_power_plant",
      description:
        "Oblicza, która elektrownia jest najbliżej podanych współrzędnych osoby. Zwraca elektrownię z najmniejszą odległością.",
      parameters: {
        type: "object",
        properties: {
          personLocations: {
            type: "array",
            description: "Tablica współrzędnych osoby",
            items: {
              type: "object",
              properties: {
                lat: { type: "number" },
                lon: { type: "number" },
              },
            },
          },
          powerPlants: {
            type: "array",
            description: "Tablica elektrowni",
            items: {
              type: "object",
              properties: {
                code: { type: "string" },
                lat: { type: "number" },
                lon: { type: "number" },
              },
            },
          },
        },
        required: ["personLocations", "powerPlants"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_access_level",
      description: "Pobiera poziom dostępu dla danej osoby",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Imię osoby",
          },
          surname: {
            type: "string",
            description: "Nazwisko osoby",
          },
          birthYear: {
            type: "number",
            description: "Rok urodzenia osoby (tylko rok, np. 1987)",
          },
        },
        required: ["name", "surname", "birthYear"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_answer",
      description: "Wysyła ostateczną odpowiedź z informacją o podejrzanym",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Imię podejrzanego",
          },
          surname: {
            type: "string",
            description: "Nazwisko podejrzanego",
          },
          accessLevel: {
            type: "number",
            description: "Poziom dostępu podejrzanego",
          },
          powerPlant: {
            type: "string",
            description: "Kod elektrowni (np. PWR1234PL)",
          },
        },
        required: ["name", "surname", "accessLevel", "powerPlant"],
      },
    },
  },
];

// Obsługa wywołań narzędzi
async function handleToolCall(toolCall) {
  const functionName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  console.log(`\n🔧 Wywołanie narzędzia: ${functionName}`);
  console.log(`   Argumenty:`, JSON.stringify(args, null, 2));

  switch (functionName) {
    case "get_power_plants":
      return await getPowerPlants();

    case "get_person_locations":
      return await getPersonLocations(args.name, args.surname);

    case "calculate_closest_power_plant": {
      let closestOverall = null;
      let minDistanceOverall = Infinity;

      for (const personLoc of args.personLocations) {
        const closest = findClosestPowerPlant(
          personLoc.lat,
          personLoc.lon,
          args.powerPlants
        );
        if (closest && closest.distance < minDistanceOverall) {
          minDistanceOverall = closest.distance;
          closestOverall = closest;
        }
      }

      return closestOverall;
    }

    case "get_access_level":
      return await getAccessLevel(args.name, args.surname, args.birthYear);

    case "submit_answer":
      return await submitAnswer({
        name: args.name,
        surname: args.surname,
        accessLevel: args.accessLevel,
        powerPlant: args.powerPlant,
      });

    default:
      throw new Error(`Nieznane narzędzie: ${functionName}`);
  }
}

// Główna funkcja agenta
async function runAgent() {
  console.log("🚀 Uruchamianie agenta do rozwiązania zadania findhim...\n");

  const messages = [
    {
      role: "system",
      content: `Jesteś agentem, który ma za zadanie znaleźć podejrzaną osobę, która przebywała blisko elektrowni atomowej.

Masz dostęp do następujących danych:
- Lista podejrzanych osób: ${JSON.stringify(suspects)}

Twoje zadanie:
1. Pobierz listę elektrowni atomowych
2. Dla każdej podejrzanej osoby:
   - Pobierz listę jej lokalizacji
   - Oblicz, która lokalizacja jest najbliżej której elektrowni
3. Znajdź osobę, która była NAJBLIŻEJ jakiejkolwiek elektrowni (najmniejsza odległość)
4. Dla tej osoby pobierz poziom dostępu
5. Wyślij odpowiedź z danymi tej osoby

WAŻNE:
- Porównaj WSZYSTKIE osoby i znajdź tę z najmniejszą odległością do elektrowni
- Używaj funkcji calculate_closest_power_plant do znalezienia najbliższej elektrowni
- Po znalezieniu osoby najbliżej elektrowni, pobierz jej accessLevel
- Na końcu wyślij odpowiedź funkcją submit_answer

Działaj systematycznie i sprawdzaj wszystkich podejrzanych.`,
    },
    {
      role: "user",
      content:
        "Rozpocznij analizę. Sprawdź wszystkich podejrzanych i znajdź osobę, która była najbliżej elektrowni atomowej.",
    },
  ];

  const maxIterations = 20;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n📍 Iteracja ${iteration}/${maxIterations}`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
    });

    const message = response.choices[0].message;
    messages.push(message);

    // Jeśli agent nie wywołuje narzędzi, kończymy
    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log("\n✅ Agent zakończył działanie:");
      console.log(message.content);
      break;
    }

    // Przetwarzamy wywołania narzędzi
    for (const toolCall of message.tool_calls) {
      try {
        const result = await handleToolCall(toolCall);
        console.log(`   Wynik:`, JSON.stringify(result, null, 2));

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        console.error(`   ❌ Błąd:`, error.message);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: error.message }),
        });
      }
    }
  }

  if (iteration >= maxIterations) {
    console.log("\n⚠️  Osiągnięto maksymalną liczbę iteracji");
  }
}

// Uruchomienie agenta
runAgent().catch((error) => {
  console.error("❌ Błąd podczas wykonywania agenta:", error);
  process.exit(1);
});
