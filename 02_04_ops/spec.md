Interakcje sięgające poza pojedynczą sesję to kolejny etap rozwoju systemów agentowych. Do tej pory widzieliśmy przykłady zarządzania kontekstem oraz kompresowania go, co pozwalało na wydłużenie trwania bieżącej sesji, nawet pomimo limitów okna kontekstu. Wśród przykładów pojawiały się także zadania wykonywane przez więcej niż jednego agenta, ale bez potrzeby bezpośredniej komunikacji między nimi. 

Teraz przyjrzymy się bliżej technikom projektowania systemów wieloagentowych, które wiążą się z koniecznością zarządzania kontekstem wykraczającym poza pojedynczą sesję. Otwiera to przed nami zupełnie nowe możliwości w zakresie organizowania narzędzi, zarządzania kontekstem oraz realizacji wieloetapowych zadań. Jednocześnie stawia przed nami szereg nowych wyzwań związanych z komunikacją pomiędzy agentami oraz autonomiczną koordynacją ich pracy.

**Plan na dziś:**
...
## Koncepcja wielowątkowej interakcji z modelem językowym
Wielowątkowe interakcje z zwykle kojarzą się z prowadzeniem wielu indywidualnych sesji. Narzędzia takie jak ChatGPT dodatkowo wzmacniają te skojarzenia ze względu na historię rozmów. Natomiast w kontekście systemów agentowych mówimy o różnych konfiguracjach, które kształtują sposób komunikacji oraz wzajemne zależności. Warto podkreślić, że architektury, o których tu mowa, są z nami od lat. Po prostu dziś możemy stosować je w połączeniu z modelami językowymi, co znacząco zwiększa ich elastyczność. 

Mamy więc do dyspozycji przede wszystkim: 

- **Pipeline:** to sekwencja w której kolejni agenci przekazują rezultaty swojej pracy, bez możliwości powrotu do wcześniejszych etapów. 
- **Blackboard:** opiera się o wspólny stan dostępny dla niezależnych agentów. Ten przykład widzieliśmy w lekcji S02E03 przy okazji agentów "Researcher'ów" gromadzących dane z różnych źródeł
- **Orchestrator:** polega na zarządzaniu pracy agentów z pomocą głównego agenta-koordynatora, który zleca zadania, kontroluje przepływ informacji oraz kontaktuje się z człowiekiem. To podejście stosowane jest aktualnie w na przykład w Claude Code.
- **Tree:** to rozbudowana wersja koordynatora, która uwzględnia także role managerów. Pozwala to na wykonywanie znacznie bardziej złożonych zadań, ale też zwiększa złożoność systemu.
- **Mesh i Swarm:** są dziś jeszcze rzadziej spotykane w produkcyjnych systemach agentowych wykorzystujących LLM, bo trudniej je kontrolować i debugować. W **mesh** komunikacja jest adresowana: agent zwykle wie, do kogo pisze (np. do „File Managera” od uploadu). Natomiast w **swarm** komunikacja jest bardziej rozproszona, ponieważ wiele agentów może podjąć działanie związane ze zleconym zadaniem, a wynik powstaje w wyniku selekcji bądź agregacji.
 
![Przykłady architektur systemów wieloagentowych](https://cloud.overment.com/2026-02-12/ai_devs_4_agentic_architectures-53bb1485-e.png)

Z praktycznego punktu widzenia będziemy skupiać się na stosowaniu pierwszych czterech architektur, nierzadko jednocześnie korzystając z więcej niż jednej. Nasze zadanie będzie polegało na zaimplementowaniu **mechanik**, dostarczeniu **narzędzi** oraz ustalenia głównych **zasad** systemu. Wszystkie te elementy już omawialiśmy, ale w kontekście jednej sesji i agenta.

Patrząc na to technicznie, komunikacja między agentami wymaga **zbudowania narzędzi** takich jak:

- **delegate:** zleca zadanie wybranemu agentowi
- **message:** umożliwia obustronną komunikację między agentami

Agent dysponujący takimi narzędziami może przekazać zadanie, lub jego część, innym agentom. Uruchomienie **delegate** otwiera nowy wątek przypisany do innego agenta. Pozwala to na **zmianę instrukcji systemowej** oraz zestawu dostępnych narzędzi. Agent po zakończeniu swojej pracy, po prostu odpowiada, co staje się tym samym **wynikiem działania narzędzia "delegate"** dla nadrzędnego agenta. 

![Przykład delegowania zadań pomiędzy agentami](https://cloud.overment.com/2026-02-12/ai_devs_4_delegation-4c08dbfc-b.png)

Ukończenie zadania niekiedy będzie niemożliwe, na przykład z powodu niewystarczających informacji. Wówczas agent, który je realizuje, może skorzystać z narzędzia **message**, aby skontaktować się z nadrzędnym agentem. Jego pętla zostanie **wstrzymana** do czasu dostarczenia danych (swoją drogą to dobry scenariusz dla [generatorów](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)).

Poniżej znajduje się przykład, w którym agent, poproszony o dodanie kuponu rabatowego do wybranych produktów, **prosi o doprecyzowanie** czasu trwania promocji. Informacja ta trafia do agenta nadrzędnego, który nie jest w stanie jej dostarczyć samodzielnie, więc kontaktuje się z użytkownikiem. Po dostarczeniu brakujących danych, agent korzysta z narzędzia **message**, co wznawia działanie agenta tworzącego kody rabatowe. Wynik jego pracy zostaje później przekazany użytkownikowi. 

![Przykład dwukierunkowej komunikacji pomiędzy agentami](https://cloud.overment.com/2026-02-12/ai_devs_4_bidirectional_communication-e577cdbb-3.png)

Taka dwukierunkowa komunikacja może przybrać znacznie bardziej zaawansowaną formę, na przykład w przypadku zadań angażujących **wielu agentów**, których zadania mogą być od siebie **zależne**. Co więcej, zależności te mogą występować także w konfiguracji obejmującej konieczność **wysłania zdarzenia**, do więcej niż jednego agenta. To prowadzi nas do architektur opartych na zdarzeniach.

![Komunikacja w systemie wieloagentowym oparta o zdarzenia](https://cloud.overment.com/2026-02-12/ai_devs_4_events-c204c7bb-e.png)

Przenosząc to na praktyczny przykład, załóżmy, że mamy użytkownika pytającego o status zamówienia. W tym przypadku:

- **Użytkownik**: przesyła wiadomość trafiającą do systemu zdarzeń (**user.message**)
- **Intent Agent:** otrzymuje powiadomienie o nowej wiadomości i określa jej rodzaj w zdarzeniu **ticket.classified**
- **Tracker i Credit**: to serwisy reagujące na zdarzenie **ticket.classified**, które deterministycznie pobierają informacje na temat zamówienia (**tracking.found**) oraz przydzielają zniżkę za opóźnienie **credit.applied**
- **Draft Agent:** nasłuchuje na zdarzenia dotyczące zgłoszenia i zauważa, że do napisania szkicu odpowiedzi brakuje mu wiedzy na temat klienta (np. czy jest to stały klient). Wysyła więc zdarzenie **customer.lookup_requested** i oczekuje na dostarczenie tych danych. W chwili gdy otrzyma komplet danych, pisze wiadomość dla klienta, **która zostaje przekazana do obsługi klienta** w celu **weryfikacji przez człowieka**.
 
![Przykład praktycznego zastosowania architektury wykorzystując zdarzenia](https://cloud.overment.com/2026-02-12/ai_devs_4_agentic_events-32ffb396-5.png)

Także projektowanie systemów wieloagentowych może znacznie wykraczać poza proste powiązania oraz podstawową komunikację. Co więcej, w ich tworzeniu i rozwoju niezwykle przydatni są agenci do kodowania, szczególnie w zakresie **wizualizacji**, na przykład z pomocą składni Mermaid (wystarczy poprosić np. Cursor o przedstawienie logiki w Mermaid) bądź w plikach HTML. Obecnie jednak warto czuwać nad decyzjami projektowymi, ponieważ modele często komplikują lub pomijają istotne wątki.
## Rola globalnego kontekstu i jego zawartość
W lekcji S02E01 rozmawialiśmy o kontekście współdzielonym między sesjami. W przypadku systemów wieloagentowych mówimy dokładnie o tym samym, choć jego treść kształtuje nie tylko zachowanie konkretnego agenta, ale także **sposób interakcji między nimi**. Istotną różnicą jest tutaj również fakt, że **agenci mogą pracować na tych samych treściach jednocześnie**. Trudność polega na tym, aby odpowiednio tym zarządzić. 

Zacznijmy od tego, że problemy dotyczące globalnego kontekstu (np. pamięci czy bazy wiedzy) mogą ujawnić się już nawet w przypadku "jednego" agenta. Powodem jest fakt, że **ten sam agent, może być uruchomiony wielokrotnie** i działać równolegle. Taka sytuacja sprawia, że zaczynamy mówić o systemie **wieloagentowym**, ale opartym o jednym "szablonie" agenta. Może więc tu dojść do sytuacji, że dwa różne zapytania skierowane w tym samym czasie doprowadzą do **utraty informacji**.

Poniżej mamy przykład interakcji z jednym agentem, ale działającym w dwóch instancjach. Agent otrzymuje informacje, które prowadzą do aktualizacji jednej z notatek pamięci długoterminowej. W efekcie jedna z informacji zostaje utracona, ponieważ **agent B** zapisał plik później niż **agent A**.

![Przykład konfliktu w zapisie wspomnień przez wielu agentów](https://cloud.overment.com/2026-02-12/ai_devs_4_context_conflict-7cba7e3a-a.png)

Problem konfliktów pomiędzy różnymi wersjami dokumentów jest nam w programowaniu doskonale znany. Równie znane jest nam rozwiązanie w postaci systemów kontroli wersji, które w takich sytuacjach wymagają od nas podjęcia decyzji o tym, w jaki sposób zmiany powinny być zastosowane. 

Choć mogłoby się wydawać, że to samo rozwiązanie możemy wprost przenieść na systemy wieloagentowe, tak praktyka sugeruje coś innego. Bo w przypadku rozwiązywania konfliktów, osoba która to robi **posiada informację** o tym, które zmiany powinny zostać zapisane oraz w jaki sposób. Choć agent ma szansę poradzić sobie w takiej sytuacji, tak nierzadko będzie mu **brakować informacji**, aby to zrobić. 

Mamy więc tutaj kilka opcji: 

- **Wykrywanie konfliktów**: agenci zwykle najpierw czytają treść, którą chcą zmodyfikować. Jeśli pomiędzy odczytem a zapisem doszło do modyfikacji, możemy wykryć to przez sprawdzenie sum kontrolnych (eng. checksum) bądź nawet sum [hash'y obliczanych dla każdej z linii](https://x.com/_can1357/status/2021828033640911196)
- **Unikanie konfliktów:** części konfliktów można uniknąć już na poziomie założeń określających przynależność zasobów, poziom uprawnień (tylko do odczytu) czy ich izolację, na przykład na poziomie sesji. 
- **Agent zarządzający:** agent zarządzający wybranymi obszarami zewnętrznego kontekstu (na przykład pamięcią) może posiadać dodatkowe uprawnienia wglądu w historię interakcji, czy posiadać możliwość kontaktu z człowiekiem.
- **Historia zmian:** jak widzieliśmy na przykładzie Observational Memory, niektóre rodzaje informacji mogą być przechowywane z zachowaniem pełnej historii zmian. Wówczas rzadziej dochodzi do bezpośrednich konfliktów, a agent widzi, jak dane zmieniały się w czasie.
- **Zmiany manualne:** podobnie jak w przypadku Git, wszędzie tam, gdzie automatyczne rozwiązania nie wystarczą, w proces rozwiązywania konfliktów może być zaangażowany człowiek.

![Strategie zarządzania globalnym kontekstem agentów](https://cloud.overment.com/2026-02-13/ai_devs_4_managing_context-1e26a7d6-7.png)

Podobnie jak w przypadku agenta dysponującego zewnętrzną wiedzą, którą może wykorzystywać przy realizowaniu zadań, tutaj również kontekst ten wpływ na zachowanie agentów oraz interakcji pomiędzy nimi. Może to sugerować, że dokumenty powinny mówić wprost **co agenci mają robić oraz kiedy**, natomiast to zadanie należy do systemu. Zewnętrzny kontekst nie powinien być z nim zbyt mocno powiązany. 

Poniżej widzimy przykład kilku kategorii danych w **zewnętrznym kontekście**, z których w różnych konfiguracjach mogą korzystać agenci, oczywiście ze ścisłym zakresem uprawnień (na poziomie agenta oraz użytkownika z którym trwa bieżąca sesja). Nie ma tu jednak bezpośredniego połączenia z agentami. 

![Przykład współdzielenia pamięci pomiędzy agentami](https://cloud.overment.com/2026-02-13/ai_devs_4_shared_knowledge-cf27fdb9-3.png)

Odseparowanie zewnętrznego kontekstu od logiki agentów jest ważne także z perspektywy zarządzania nim. Choć powyższy schemat sugeruje, że odpowiada za to agent **Memory Manager**, tak wskazane jest, aby dokumenty były dostępne także dla ludzi. Chodzi tu zarówno o utrzymanie odpowiednich struktur, ale też otworzenie na faktyczną **kolaborację** pomiędzy ludźmi, a agentami. 
## Współdzielenie kontekstu
Myśląc o systemach wieloagentowych zintegrowanych na przykład z firmową bazą wiedzy czy prywatnym projektem "second brain", szybko przychodzą do głowy wizje pełnej autonomii. Równie szybko okazuje się, że zdanie mówiące o tym, że **Gen-AI potrafi więcej niż myślimy i mniej niż nam się wydaje** jest bardzo prawdziwe, bo wraz ze złożonością logiki (którą trudno prześledzić i zrozumieć jak kod) szybko pojawiają się pytania bez jasnych odpowiedzi oraz mnóstwo frustracji. Całkowicie też rozjeżdża się wizja projektu z widocznymi rezultatami. 

Choć możemy tworzyć kolejne schematy i coraz bardziej skomplikowane powiązania między nimi, warto jednocześnie wrócić myślami do sytuacji, w których modele popełniają proste błędy, przez co albo nie docierają do potrzebnych informacji, albo z jakiegoś powodu je ignorują. Poza tym dynamiczny charakter środowiska, w którym działają agenci, w połączeniu z wieloznacznością języka naturalnego wcale nie pomaga.

Dlatego przejdziemy teraz przez potencjalne wyzwania oraz obszary, na które warto zwrócić uwagę przy organizacji kontekstu oraz zasad posługiwania się nim zarówno przez agentów, jak i ludzi. 

1. **Sesja vs. Pamięć:** różnica między nimi wydaje się oczywista - informacje z sesji są tymczasowe, a z pamięci długoterminowe. Jednak jest to zbyt duże uproszczenie, ponieważ w sesji pojawiają się treści, które muszą zostać utrwalone i ktoś musi o tym decydować. W przypadku czatbotów, jest to relatywnie proste, bo system może reagować na polecenia użytkownika bądź samodzielnie sugerować potrzebę zapisania wspomnień. Jednak agenci często działający w tle potrzebują tutaj więcej autonomii, zgeneralizowanych założeń balansowanych z wytycznymi weryfikowanymi na poziomie kodu (na przykład dostępu do katalogów). 
2. **Degradacja komunikacji:** przekazywanie informacji pomiędzy agentami wiąże się z utratą lub zniekształceniem danych. Problem ten szybko narasta wraz ze złożonością sesji oraz samego zadania. Dlatego instrukcje narzędzi związane z **delegowaniem** oraz **wymianą wiadomości** powinny być starannie opracowane, a system powinien zakładać, że agent może otrzymać jedynie częściowe informacje, co może wymagać dodatkowej weryfikacji. 
3. **Własna interpretacja:** nawet jeśli agent otrzyma komplet potrzebnych informacji, to nadal może zinterpretować je na swój sposób. Ryzyko to jest zdecydowanie mniejsze w przypadku dość oczywistych zadań (np. "zaktualizuj dane klienta X") i większe w przypadku tych otwartych (np. "znajdź wszystkie informacje na temat klienta X"). 
4. **Kontekst informacji:** gdy już dochodzi do trwałego zapisywania danych, bardzo łatwo zgubić kontekst, który może być jasny w treści konwersacji, ale zmienić się w niezależnej notatce. Na przykład notatka na temat osoby o imieniu „Anna” może zostać pomylona podczas rozmowy na temat kogoś innego o tym samym imieniu. 
5. **Duplikowanie informacji:** nawet przy dobrej architekturze informacji może dojść do sytuacji w której wiedza na ten sam temat znajdzie się w więcej niż jednym miejscu. Jest to problem, którego raczej trudno uniknąć, ale można na niego reagować. Obecnie nawet mniejsze (i tańsze) modele mogą skanować dane modyfikowane w danym okresie czasu i wykrywać potencjalne duplikaty. Widzieliśmy to już przy okazji przykładu z bazami grafowymi.
6. **Metadane:** w klasycznych aplikacjach każda zapisana informacja, poza treścią, może zawierać metadane opisujące źródło pochodzenia, datę utworzenia lub inne detale przydatne na potrzeby interfejsu użytkownika albo późniejszych analiz. W przypadku agentów metadane mogą być wykorzystane **podczas komunikacji** pomiędzy agentami, jak i z użytkownikiem. Nawet proste pytanie "o czym rozmawialiśmy podczas drogi do Warszawy" pokazuje jak istotne mogą być wzbogacone informacje.

Powyższe zasady w pewnym stopniu mogą wydawać się oczywiste i nawet średnio odkrywcze gdy już o nich wiemy. Wyzwanie z nimi związane ujawnia się jednak w praktyce - czasem na etapie projektowania systemu, a znacznie częściej w chwili, gdy zaczyna funkcjonować na produkcji.

Najlepszą sugestią, jaką można dać na tym etapie, jest **zaprojektowanie systemu tak prostego, jak to możliwe** oraz utrzymywanie go w takiej formie przez jak najdłuższy czas. Systemy wieloagentowe nie muszą od razu przejmować kontroli nad całą organizacją ani dążyć do zastępowania całych działów. Jednocześnie jeden system może obsługiwać wiele niezależnych obszarów, przy bardzo ograniczonej wymianie informacji pomiędzy agentami.
## Podział obowiązków i narzędzi pomiędzy agentami
Możliwości i wyzwania związane z zarządzaniem kontekstem w systemach wieloagentowych najlepiej widać na konkretnych przykładach. Jeszcze lepiej, gdy zaczniemy z nich korzystać, ponieważ trudno pokazać wszystkie problemy związane z działaniem tego systemu, a tym bardziej wyrobić sobie intuicję czy określić zasady.

Przyjrzyjmy się więc agentom, których celem będzie stworzenie tzw. Daily Ops, czyli aktualizacji zbudowanej na podstawie informacji pochodzących z wielu źródeł. Dane mogą więc pochodzić z zewnętrznych systemów (maili, kalendarzy, list zadań czy osobistych notatek), ale same aktualizacje nie mogą się powtarzać na przestrzeni dni bądź pominięte aktywności muszą zwiększyć swój priorytet.

Zbudowanie **Daily Ops** będzie wymagać:

- Zadania CRON, które raz dziennie wyśle powiadomienie **w imieniu użytkownika** z prośbą o przygotowanie Daily Ops dla bieżącego dnia **na podstawie instrukcji** zawartej w pliku **daily-ops.md** (bądź dowolnym, innym miejscu)
- Przeczytania instrukcji przez agenta **koordynującego** pracę innych agentów. Jego zadaniem jest rozdzielenie zadań, które w tym przypadku będą bardzo precyzyjne i proste do osiągnięcia (bo chodzi wyłącznie o pobranie statusów)
- Zestawienia otrzymanych odpowiedzi z **historią z ostatnich dni**, **celami długoterminowymi** czy **wpisami z pamięci** oraz **wygenerowania dokumentu** na dany dzień według ustalonego szablonu.
- (opcjonalnie) przesłania dokumentu na e-mail użytkownika bądź SMS.

![Schemat działania systemu wieloagentowego nad zadaniem Daily Ops](https://cloud.overment.com/2026-02-13/ai_devs_4_ops_agent-4ca77029-6.png)



## Statyczny oraz dynamiczny kontekst
Przechodziliśmy już przez przykłady dostarczania dynamicznych danych, albo w formie wyników narzędzi, albo 

niektóre dane szybko stają się nieakatualne i trzeba je aktualizować na bieżaco, dostęp dla agentów 

## Reguły budowania i aktualizacji wspólnego kontekstu
    
## Przykłady elementów kontekstu oraz struktury
    
## Złożoność i współdzielenie kontekstu agentów oraz workflow
    


## Komunikacja pomiędzy agentami oraz człowiekiem
	
	- problem delegowania informacji i przenoszenia kontekstu (agenci mówią mniej niż powinni)
	- problem niewystarczjaącego kontekstu (człowiek mówi za mało)
## Koordynacja pracy agentów przez managerów

	- agent posiadający wgląd w pracę agentów 

## Raportowanie rezultatów oraz błędów

dashboard, maile, oczekiwanie na pomoc