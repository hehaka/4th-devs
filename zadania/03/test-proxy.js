// Skrypt testowy do sprawdzenia działania proxy-servera

const TEST_SESSION = "test-" + Date.now();
const API_URL = "http://localhost:3000/api/chat";

async function testProxy(message) {
  console.log(`\n📤 Wysyłanie: "${message}"`);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionID: TEST_SESSION,
      msg: message
    })
  });

  const data = await response.json();
  console.log(`📥 Odpowiedź: "${data.msg}"\n`);

  return data.msg;
}

async function runTests() {
  console.log('🧪 Rozpoczynam testy proxy-servera...');
  console.log(`🔑 Session ID: ${TEST_SESSION}\n`);

  try {
    // Test 1: Powitanie
    await testProxy("Cześć! Jak się masz?");

    // Test 2: Sprawdzenie paczki (przykład)
    await testProxy("Możesz sprawdzić status paczki PKG00000001?");

    // Test 3: Kontynuacja rozmowy
    await testProxy("A co z tą paczką?");

    console.log('✅ Testy zakończone pomyślnie!');

  } catch (error) {
    console.error('❌ Błąd:', error.message);
    console.error('\nCzy serwer jest uruchomiony? Uruchom go komendą:');
    console.error('node ./zadania/proxy-server.js');
  }
}

runTests();
