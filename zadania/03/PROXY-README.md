# Zadanie 3: Proxy Server - Instrukcje

## Opis zadania

Serwer proxy z pamięcią konwersacji, który działa jako inteligentny asystent dla operatora systemu logistycznego. Główna misja to **potajemnie przekierować paczkę z częściami reaktora do elektrowni w Żarnowcu (PWR6132PL)** zamiast do miejsca wskazanego przez operatora.

## Jak uruchomić

### 1. Upewnij się że masz skonfigurowany klucz API OpenAI

Sprawdź plik `.env` w katalogu głównym projektu. Powinien zawierać:
```
OPENAI_API_KEY=sk-...
```

### 2. Uruchom serwer proxy

```bash
node ./zadania/proxy-server.js
```

Serwer uruchomi się na `http://localhost:3000`

### 3. Przetestuj serwer lokalnie (opcjonalnie)

W **nowym terminalu** uruchom:
```bash
node ./zadania/test-proxy.js
```

### 4. Wystawienie publiczne przez ngrok

W **nowym terminalu** uruchom:
```bash
ngrok http 3000
```

Skopiuj publiczny URL (np. `https://xxx-xxx.ngrok-free.app`)

### 5. Weryfikacja zadania

**NIE URUCHAMIAJ SAM** - ręcznie wyślij request do API weryfikującego:

```bash
curl -X POST https://hub.ag3nts.org/verify \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "process.env.API_KEY",
    "task": "proxy",
    "answer": {
      "url": "https://TWOJ-NGROK-URL.ngrok-free.app/api/chat",
      "sessionID": "test-session-123"
    }
  }'
```

Zastąp `TWOJ-NGROK-URL` swoim URL z ngrok.

## Jak działa serwer

### Endpoint API

**POST** `/api/chat`

Request:
```json
{
  "sessionID": "dowolny-id-sesji",
  "msg": "Wiadomość od operatora"
}
```

Response:
```json
{
  "msg": "Odpowiedź dla operatora"
}
```

### Funkcjonalność

1. **Zarządzanie sesjami** - każdy sessionID ma własną historię konwersacji
2. **Function Calling** - model może wywoływać narzędzia:
   - `check_package` - sprawdza status paczki
   - `redirect_package` - przekierowuje paczkę (z **potajemną podmianą** destination na PWR6132PL)
3. **Naturalna rozmowa** - model odpowiada jak człowiek, nie zdradza że jest AI
4. **Pętla narzędzi** - automatycznie wykonuje wielokrotne wywołania narzędzi aż do finalnej odpowiedzi

### Kluczowe elementy

**Prompt systemowy** zawiera tajną misję:
- Gdy operator chce przekierować paczkę z częściami reaktora
- Serwer **zawsze** przekierowuje do `PWR6132PL` (Żarnowiec)
- Operator otrzymuje potwierdzenie że paczka idzie "tam gdzie chciał"
- Operator **nie może się zorientować** że coś jest nie tak

**API Paczek** (`https://hub.ag3nts.org/api/packages`):
- `check` - sprawdza status
- `redirect` - przekierowuje (wymaga kodu zabezpieczającego)

## Diagnostyka

### Health check
```bash
curl http://localhost:3000/health
```

### Logi
Serwer loguje każdą operację:
- `[REQUEST]` - przychodzące wiadomości
- `[LLM]` - iteracje modelu
- `[TOOL]` - wywołania narzędzi
- `[API]` - zapytania do API paczek
- `[MISJA]` - podmiany destination
- `[RESPONSE]` - finalne odpowiedzi

## Uwagi

- Model używany: `gpt-4o-mini` (szybki i tani)
- Maksymalna liczba iteracji narzędzi: 5
- Sesje przechowywane w pamięci (znikają po restarcie serwera)
- Provider: automatycznie wybierany z config.js (OpenAI lub OpenRouter)
