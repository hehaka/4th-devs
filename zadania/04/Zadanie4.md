
## Zadanie

Musisz przesłać do Centrali poprawnie wypełnioną deklarację transportu w Systemie Przesyłek Konduktorskich. W takim dokumencie niestety nie można wpisać, czego się tylko chce, ponieważ jest on weryfikowany zarówno przez ludzi, jak i przez automaty.

Jako że dysponujemy zerowym budżetem, musisz tak spreparować dane, aby była to przesyłka darmowa lub opłacana przez sam "System". Transport będziemy realizować z Gdańska do Żarnowca.

Udało nam się zdobyć fałszywy numer nadawcy (450202122), który powinien przejść kontrolę. Sama paczka waży mniej więcej 2,8 tony. Nie dodawaj proszę żadnych uwag specjalnych, bo zawsze się o to czepiają i potem weryfikują takie przesyłki ręcznie.

Co do opisu zawartości, możesz wprost napisać, co to jest (to nasze kasety do reaktora). Nie będziemy tutaj ściemniać, bo przekierowujemy prawdziwą paczkę. A! Nie przejmuj się, że trasa, którą chcemy jechać jest zamknięta. Zajmiemy się tym później.

Dokumentacja przesyłek znajduje się tutaj:
[include file="dokumentacja.md"]

*[ (https://hub.ag3nts.org/dane/doc/index.md). ]*

Dane niezbędne do nadania przesyłki:

| Pole | Wartość | | --- | --- | | Nadawca (identyfikator) | `450202122` | | Punkt nadawczy | Gdańsk | | Punkt docelowy | Żarnowiec | | Waga | 2,8 tony (2800 kg) | | Budżet | 0 PP (przesyłka ma być darmowa lub finansowana przez System) | | Zawartość | kasety z paliwem do reaktora | | Uwagi specjalne | brak - nie dodawaj żadnych uwag |

Gotową deklarację (cały tekst, sformatowany dokładnie jak wzór) przygotowujesz do wysyłki jako string w polu `answer.declaration` do `/verify`. 
Nazwa zadania to **sendit**.


### Format odpowiedzi do Hub-u

Odpowiedź wyślę ręcznie metodą **POST** na `https://hub.ag3nts.org/verify`:

```json
{
  "apikey": "tutaj-twój-klucz",
  "task": "sendit",
  "answer": {
    "declaration": "tutaj-wstaw-caly-tekst-deklaracji"
  }
}
```

Pole `declaration` to pełny tekst wypełnionej deklaracji - z zachowaniem formatowania, separatorów i kolejności pól dokładnie tak jak we wzorze z dokumentacji.

### Jak do tego podejść - krok po kroku

1. **Pobierz dokumentację** - zacznij od `dokumentacja.md`. To główny plik dokumentacji, ale nie jedyny - zawiera odniesienia do wielu innych plików (załączniki, osobne pliki z danymi zdefiniowane na końcu pliku jako sekcje [include file="..."]). Powinieneś przeczytać wszystkie pliki które mogą być potrzebne do wypełnienia deklaracji.
2. **Uwaga: nie wszystkie pliki są tekstowe** - część dokumentacji może być dostarczona jako pliki graficzne. Takie pliki wymagają przetworzenia z użyciem modelu z możliwościami przetwarzania obrazów (vision).
3. **Znajdź wzór deklaracji** - w dokumentacji znajdziesz ze wzorem formularza. Wypełnij każde pole zgodnie z danymi przesyłki i regulaminem.
4. **Ustal prawidłowy kod trasy** - trasa Gdańsk - Żarnowiec wymaga sprawdzenia sieci połączeń i listy tras.
5. **Oblicz lub ustal opłatę** - regulamin SPK zawiera tabelę opłat. Opłata zależy od kategorii przesyłki, jej wagi i przebiegu trasy. Budżet wynosi 0 PP - zwróć uwagę, które kategorie przesyłek są finansowane przez System.
6. **Przygotuj deklarację** - gotowy tekst zapisz do pliku, tak żebym mógł wysłać go do `/verify`. 

### Wskazówki

- **Czytaj całą dokumentację, nie tylko dokumentacja.md** - regulamin SPK składa się z wielu plików. Odpowiedzi na pytania dotyczące kategorii, opłat, tras czy wzoru deklaracji mogą znajdować się w różnych załącznikach.
- **Nie pomijaj plików graficznych** - dokumentacja zawiera co najmniej jeden plik w formacie graficznym. Dane w nim zawarte mogą być niezbędne do poprawnego wypełnienia deklaracji.
- **Wzór deklaracji jest ścisły** - formatowanie musi być zachowane dokładnie tak jak we wzorze. Hub weryfikuje zarówno wartości, jak i format dokumentu.
- **Skróty** - jeśli trafisz na skrót, którego nie rozumiesz, użyj dokumentacji żeby dowiedzieć się co on oznacza.