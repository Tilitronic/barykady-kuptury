-- T-012 seed fixtures.
--
-- The site_pages block below contains verified organization facts only
-- (T-016). Other tables hold clearly fictional sample fixtures to exercise the
-- schema (docs/TESTING.md §6) and are replaced by verified content in later
-- tickets (T-017/T-018/T-020).
--
-- Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING, so re-running never
-- duplicates rows. Seeds execute as the migration superuser and bypass RLS.

-- ---------------------------------------------------------------------------
-- Site page: verified EN content; PL/UK titles only, flagged for review
-- ---------------------------------------------------------------------------

insert into public.site_pages (id, page_key, status, sort_order, published_at)
values ('00000000-0000-4000-8000-000000000101', 'about', 'published', 1, '2026-01-05T12:00:00Z')
on conflict (id) do nothing;

insert into public.site_page_translations (id, page_id, locale, title, body, meta_description, needs_review)
values
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'en',
   'About us',
   E'## Mission\n\nTo expand Ukrainian culture beyond borders and give it the space it deserves.\n\n## History\n\nThe association was founded by Daria Yakovleva in Poznań.\n\n## Values\n\n- Identity\n- Education\n- Support\n- Community\n\n## Aims\n\nThe aims of the Association are:\n\n- Cultural diplomacy: acting as a "cultural bridge" between Ukrainians, Poles, and the international community.\n- Non-formal, educational and upbringing activities: popularizing knowledge, developing soft and civic skills, as well as raising youth awareness of democratic political processes.\n- Development of critical thinking and countering propaganda and disinformation.\n- Human rights protection, promoting gender equality, protecting women''s rights and the dignity of migrants and refugees.\n- Integration and support: activities for national and ethnic minorities, supporting the adaptation processes of Ukrainians and other foreigners in Poland.\n- National heritage and historical memory: protection of cultural assets and the restoration and cultivation of historical memory, with particular emphasis on the care of Ukrainian graves and memorial sites in Poland.\n- Environmental protection: initiating and supporting research on the impact of the Russian war on the ecology.\n- Promotion and organization of volunteering, as well as charitable activities.\n- Promotion and popularization of Ukrainian culture in Poland and worldwide.\n- Initiating public actions, assemblies, and protests in defense of human rights and democratic values.',
   'About the Barykady Kultury association.', false),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101', 'pl',
   'O nas', null, null, true),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000101', 'uk',
   'Про нас', null, null, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Projects: one published+complete (featured, covered), one draft+incomplete
-- ---------------------------------------------------------------------------

insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at
)
values (
  '00000000-0000-4000-8000-000000000201',
  'sample-community-workshop',
  'published',
  1,
  'fixtures/projects/sample-cover.webp',
  '2026-01-10',
  '2026-03-20',
  '2026-01-05T12:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (id, project_id, locale, title, summary, body)
values
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000201', 'en',
   'Sample Community Workshop (Fictional)',
   'A fictional summary used only by local development fixtures.',
   'A fictional description used only by local development fixtures.'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000201', 'pl',
   'Przykladowy warsztat spoleczny (fikcyjny)',
   'Fikcyjne podsumowanie uzywane wylacznie w lokalnych danych testowych.',
   'Fikcyjny opis uzywany wylacznie w lokalnych danych testowych.'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000201', 'uk',
   'Zrazkova hromadska maisternia (fiktyvna)',
   'Fiktyvnyi korotkyi opys dlia lokalnykh testovykh danykh.',
   'Fiktyvnyi opys dlia lokalnykh testovykh danykh.')
on conflict (id) do nothing;

insert into public.projects (id, slug, status)
values ('00000000-0000-4000-8000-000000000202', 'sample-draft-project', 'draft')
on conflict (id) do nothing;

insert into public.project_translations (id, project_id, locale, title, summary)
values (
  '00000000-0000-4000-8000-000000000221',
  '00000000-0000-4000-8000-000000000202',
  'en',
  'Sample Draft Project (Fictional)',
  'Draft fixture: Polish and Ukrainian translations are intentionally absent.'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Team member: published, optional portrait absent, roles/bios partial flags
-- ---------------------------------------------------------------------------

insert into public.team_members (id, name, status, sort_order, published_at)
values ('00000000-0000-4000-8000-000000000301', 'Sample Person (Fictional)', 'published', 1, '2026-01-05T12:00:00Z')
on conflict (id) do nothing;

insert into public.team_member_translations (id, member_id, locale, role, bio, needs_review)
values
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000301', 'en',
   'Sample Role (Fictional)',
   'Fictional fixture biography used only by local development.', false),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000301', 'pl',
   'Przykladowa rola (fikcyjna)',
   'Fikcyjna biografia uzywana wylacznie w lokalnym rozwoju.', true),
  ('00000000-0000-4000-8000-000000000313', '00000000-0000-4000-8000-000000000301', 'uk',
   'Zrazkova rol (fiktyvna)',
   'Fiktyvna biohrafiia dlia lokalnoi rozrobky.', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Publications: one with files (EN+PL), one external URL with optional fields missing
-- ---------------------------------------------------------------------------

insert into public.publications (id, slug, status, language, publication_date, external_url, sort_order, published_at)
values
  ('00000000-0000-4000-8000-000000000401', 'sample-publication', 'published', 'en', '2026-02-01', null, 1, '2026-02-01T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000402', 'sample-external-publication', 'published', 'en', null,
   'https://example.org/fictional-sample-publication', 2, '2026-02-02T09:00:00Z')
on conflict (id) do nothing;

insert into public.publication_translations (id, publication_id, locale, title, abstract, authors, needs_review)
values
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'en',
   'Sample Publication (Fictional)',
   'A fictional abstract for local development fixtures.', 'Sample Author (Fictional)', false),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000401', 'pl',
   'Przykladowa publikacja (fikcyjna)',
   'Fikcyjne streszczenie na potrzeby lokalnego rozwoju.', 'Przykladowy autor (fikcyjny)', false),
  ('00000000-0000-4000-8000-000000000413', '00000000-0000-4000-8000-000000000401', 'uk',
   'Zrazkova publikatsiia (fiktyvna)',
   'Fiktyvne reziume dlia lokalnoi rozrobky.', 'Zrazkovyi avtor (fiktyvnyi)', false),
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000402', 'en',
   'Sample External Publication (Fictional)',
   null, null, false)
on conflict (id) do nothing;

insert into public.publication_files (id, publication_id, locale, label, storage_path, mime_type, file_size_bytes)
values
  ('00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000401', 'en',
   'Sample PDF (English, fictional)', 'fixtures/publications/sample-publication-en.pdf',
   'application/pdf', 12345),
  ('00000000-0000-4000-8000-000000000432', '00000000-0000-4000-8000-000000000401', 'pl',
   'Sample PDF (Polish, fictional)', 'fixtures/publications/sample-publication-pl.pdf',
   'application/pdf', 23456)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Calendar event links: linked to published, unlinked, linked to a draft
-- ---------------------------------------------------------------------------

insert into public.calendar_event_links (id, calendar_id, google_event_id, project_id)
values
  ('00000000-0000-4000-8000-000000000501', 'sample-calendar@example.org',
   'fictional-event-linked-published', '00000000-0000-4000-8000-000000000201'),
  ('00000000-0000-4000-8000-000000000502', 'sample-calendar@example.org',
   'fictional-event-unlinked', null),
  ('00000000-0000-4000-8000-000000000503', 'sample-calendar@example.org',
   'fictional-event-linked-draft', '00000000-0000-4000-8000-000000000202')
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Organization document: Regulations (in-app readable text, D-12 / T-017)
-- One published "regulations" document with pl/en/uk translations. The bodies
-- are the VERBATIM texts of
-- NGOinfoSources/regulamen/Regulations_Barykady_Kultury_{EN,PL,UKR}_V4.docx,
-- mapped to the safe Markdown subset (## sections, paragraphs). Dollar-quoted,
-- so no character of the source wording is escaped or altered.
-- `publication_date` is intentionally null: the source gives no date, and the
-- listing collapses missing optional metadata instead of inventing one.
-- ---------------------------------------------------------------------------

insert into public.organization_documents (
  id, slug, status, document_type, language, storage_path, publication_date, sort_order, published_at
)
values (
  '00000000-0000-4000-8000-000000000601', 'regulations', 'published', 'regulations', null, null, null, 1, '2026-01-05T12:00:00Z'
)
on conflict (id) do nothing;

insert into public.organization_document_translations (
  id, document_id, locale, title, body, needs_review
)
values
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000601', 'en',
   'Regulations of the Ordinary Association',
   $regulations_en$Ordinary Association "Barykady Kultury"

## § 1

1. The Association is named Ordinary Association "Barykady Kultury", hereinafter referred to as the "Association".

2. The Association is a voluntary, self-governing, permanent, non-profit organization without legal personality.

3. The Association is an ordinary association within the meaning of the Law on Associations.

4. The basis of the Association's activities is the provisions of the Act of April 7, 1989, Law on Associations, and the provisions of these Regulations.

5. The area of the Association's activity is the territory of the Republic of Poland, with particular emphasis on the city of Poznań.

6. The seat of the Association is the city of Poznań.

7. The languages of communication and documentation within the Association are Polish, Ukrainian, and English.

## § 2

The aims of the Association are:

1. Cultural diplomacy: acting as a "cultural bridge" between Ukrainians, Poles, and the international community.

2. Non-formal, educational and upbringing activities: popularizing knowledge, developing soft and civic skills, as well as raising youth awareness of democratic political processes.

3. Development of critical thinking and countering propaganda and disinformation.

4. Human rights protection, promoting gender equality, protecting women's rights and the dignity of migrants and refugees.

5. Integration and support: activities for national and ethnic minorities, supporting the adaptation processes of Ukrainians and other foreigners in Poland.

6. National heritage and historical memory: protection of cultural assets and the restoration and cultivation of historical memory, with particular emphasis on the care of Ukrainian graves and memorial sites in Poland.

7. Environmental protection: initiating and supporting research on the impact of the Russian war on the ecology.

8. Promotion and organization of volunteering, as well as charitable activities.

9. Promotion and popularization of Ukrainian culture in Poland and worldwide.

10. Initiating public actions, assemblies, and protests in defense of human rights and democratic values.

## § 3

The Association achieves its aims by:

1. Publishing and distributing magazines, publications, and conducting broad informational and publishing activities.

2. Organizing training sessions, workshops, seminars, and conferences on diverse topics responding to current social challenges (including countering disinformation, personal development, psychology, civil rights).

3. Organizing and conducting language courses facilitating the adaptation and integration of foreigners in Poland.

4. Initiating and implementing activities for the renovation, inventory, and care of Ukrainian graves and places of historical memory in the territory of Poland.

5. Working with youth and cooperating closely with educational institutions, including schools and universities.

6. Conducting research and analytical projects regarding, among others, the impact of Russian armed aggression on ecology and the natural environment.

7. Conducting and publishing interviews and documenting the social experiences of refugees and migrants.

8. Organizing social campaigns, artistic, and charitable events.

9. Cooperating with local government authorities, state authorities, media, as well as Polish and international non-governmental organizations.

10. Organizing cultural events, exhibitions, concerts, discussion forums, film screenings, and festivals.

11. Organizing and participating in legal public assemblies, social campaigns, marches, and protests.

## § 4

1. A member of the Association may be a natural person with full legal capacity and not deprived of public rights (including both Polish citizens and foreigners, regardless of their place of residence), who submits a written declaration of joining the Association and accepts these Regulations.

2. The decision to accept or refuse admission to the Association is made by the Representative. The candidate for a member is informed in writing about the decision within 7 days from the date of submitting the declaration.

3. In case of refusal of admission, an appeal to the General Meeting of Members is available within 14 days from the date of delivery of the decision. The appeal is submitted through the Representative.

4. Loss of membership occurs in the event of: a) death of the member, b) written resignation submitted to the Representative, c) loss of full legal capacity, d) loss of public rights, e) exclusion of the Association member due to: - failure to pay membership fees for a period of 6 months, - failure to comply with the resolutions of the Association's authorities and the provisions of these Regulations.

5. The resolution on the exclusion of a member from the Association is adopted by the General Meeting of Members.

6. The resolution of the General Meeting of Members regarding the exclusion is final.

7. Members of the Association are obliged to regularly pay membership fees, the amount and payment rules of which are determined by the General Meeting of Members.

## § 5

1. The authorities of the Association are: a) General Meeting of Members, b) Representative.

2. The highest authority of the Association is the General Meeting of Members, which consists of all members of the Association.

3. The General Meeting of Members may be ordinary or extraordinary.

4. The Ordinary General Meeting is convened by the Representative at least once a year.

5. The Extraordinary General Meeting is convened by the Representative: a) on their own initiative, b) upon a written, justified request of at least 1/3 of the Association's members.

6. The Extraordinary General Meeting should be convened within 30 days from the date of submitting the request.

7. The Extraordinary General Meeting deliberates only on matters for which it was convened.

## § 6

1. The General Meeting of Members is competent to make decisions on all matters of the Association, except for matters reserved by these Regulations to the competence of the Representative.

2. The exclusive competences of the General Meeting of Members include in particular: a) election and dismissal of the Representative, b) adoption and amendment of the Regulations, c) control of actions taken by the Representative, d) passing the main directions and programs of the Association's activities, e) excluding members from the Association, f) adopting a resolution on the dissolution of the Association, g) determining the amount of the membership fee, h) examining complaints of Association members regarding the Representative's activities.

3. Resolutions of the General Meeting of Members, unless the regulations state otherwise, are adopted by a simple majority of votes, in the presence of: a) in the first term – at least half of the members entitled to vote, b) in the second term – set on the same day, 30 minutes later than the first term – regardless of the number of persons entitled to vote.

4. A resolution on the dismissal of the Representative before the end of their term of office requires a majority of at least 3/4 of the votes of all members of the Association.

## § 7

1. The Association is represented by the Representative.

2. The Representative is elected by the General Meeting of Members from among the members who agreed to run.

3. The term of office of the Representative lasts 3 years.

4. The competences of the Representative include: a) admitting members to the Association, b) executing the resolutions of the General Meeting of Members, c) representing the Association externally and acting on its behalf, d) convening the General Meeting of Members.

## § 8

The Association obtains funds for its activities from membership fees, donations, inheritances, bequests, income from the Association's property, public generosity (fundraising), and grants.

## § 9

1. The financial resources of the Association are managed by the Representative, in accordance with the applicable law, these Regulations, and the resolutions of the General Meeting of Members.

2. Actions exceeding ordinary management by the Representative require the prior consent of all members of the Association and the granting of a power of attorney by them to perform these activities.

3. Actions exceeding ordinary management are: a) acquisition and disposal of real estate or the right of perpetual usufruct, b) establishment of a limited property right, c) concluding a credit or loan agreement, d) taking over a debt, acknowledging a debt, releasing from a debt, joining a debt, concluding a suretyship agreement or other similar agreement, e) incurring other liabilities exceeding the value of PLN 10,000.

## § 10

Decisions regarding amendments to the regulations and dissolution of the association are made by the General Meeting of Members by a majority of at least 2/3 of votes in the presence of at least half of the members entitled to vote. When adopting a resolution on dissolution, the General Meeting determines the destination of the remaining assets.$regulations_en$, false),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000601', 'pl',
   'Regulamin działalności stowarzyszenia zwykłego',
   $regulamin_pl$Stowarzyszenie Zwykłe „Barykady Kultury”

## § 1

1. Stowarzyszenie nosi nazwę Stowarzyszenie Zwykłe „Barykady Kultury”, w dalszej części regulaminu zwane „Stowarzyszeniem”.

2. Stowarzyszenie jest dobrowolnym, samorządnym, trwałym zrzeszeniem o celach niezarobkowych, nie posiadającym osobowości prawnej.

3. Stowarzyszenie jest stowarzyszeniem zwykłym w rozumieniu ustawy – Prawo o stowarzyszeniach.

4. Podstawą działania Stowarzyszenia są przepisy ustawy z dnia 7 kwietnia 1989 r. Prawo o stowarzyszeniach oraz postanowienia niniejszego Regulaminu.

5. Terenem działania Stowarzyszenia jest terytorium Rzeczypospolitej Polskiej, ze szczególnym uwzględnieniem miasta Poznań.

6. Siedzibą Stowarzyszenia jest miasto Poznań.

7. Językami komunikacji i dokumentacji wewnątrz Stowarzyszenia są język polski, język ukraiński oraz język angielski.

## § 2

Cele działania Stowarzyszenia:

1. Dyplomacja kulturalna: pełnienie roli "pomostu kulturalnego" między Ukraińcami, Polakami a społecznością międzynarodową.

2. Edukacja pozaformalna, oświatowa i wychowawcza: popularyzacja wiedzy, rozwój kompetencji miękkich i obywatelskich oraz podnoszenie świadomości młodzieży w zakresie demokratycznych procesów politycznych.

3. Rozwój krytycznego myślenia oraz przeciwdziałanie propagandzie i dezinformacji.

4. Ochrona praw człowieka, wspieranie równości płci, ochrona praw kobiet oraz godności migrantów i uchodźców.

5. Integracja i wsparcie: działalność na rzecz mniejszości narodowych i etnicznych, wspieranie procesów adaptacyjnych Ukraińców i innych cudzoziemców w Polsce.

6. Dziedzictwo narodowe i pamięć historyczna: ochrona dóbr kultury oraz przywracanie i pielęgnowanie pamięci historycznej, ze szczególnym uwzględnieniem opieki nad ukraińskimi grobami i miejscami pamięci w Polsce.

7. Ochrona środowiska: inicjowanie i wspieranie badań nad wpływem rosyjskiej wojny na ekologię.

8. Promocja i organizacja wolontariatu oraz działalność charytatywna.

9. Promowanie i popularyzacja kultury ukraińskiej w Polsce i na świecie.

10. Inicjowanie publicznych akcji, zgromadzeń i protestów w obronie praw człowieka oraz wartości demokratycznych.

## § 3

Stowarzyszenie realizuje swoje cele poprzez:

1. Wydawanie i dystrybucję czasopism, publikacji oraz prowadzenie szerokiej działalności informacyjnej i wydawniczej.

2. Organizację szkoleń, warsztatów, seminariów i konferencji o zróżnicowanej tematyce, odpowiadających na aktualne wyzwania społeczne (m.in. przeciwdziałanie dezinformacji, rozwój osobisty, psychologia, prawa obywatelskie).

3. Organizowanie i prowadzenie kursów językowych ułatwiających adaptację i integrację cudzoziemców w Polsce.

4. Inicjowanie i realizowanie działań na rzecz renowacji, inwentaryzacji i opieki nad ukraińskimi grobami oraz miejscami pamięci historycznej na terytorium Polski.

5. Pracę z młodzieżą oraz ścisłą współpracę z placówkami oświatowymi, w tym szkołami i uczelniami.

6. Prowadzenie badań i projektów analitycznych dotyczących m.in. wpływu rosyjskiej agresji zbrojnej na ekologię i środowisko naturalne.

7. Przeprowadzanie i publikację wywiadów oraz dokumentowanie doświadczeń społecznych uchodźców i migrantów.

8. Organizowanie kampanii społecznych, wydarzeń artystycznych i charytatywnych.

9. Współpracę z władzami samorządowymi, państwowymi, mediami oraz polskimi i międzynarodowymi organizacjami pozarządowymi.

10. Organizowanie wydarzeń kulturalnych, wystaw, koncertów, forów dyskusyjnych, pokazów filmowych oraz festiwali.

11. Organizowanie i uczestniczenie w legalnych zgromadzeniach publicznych, akcjach społecznych, marszach i protestach.

## § 4

1. Członkiem Stowarzyszenia może zostać osoba fizyczna posiadająca pełną zdolność do czynności prawnych i niepozbawiona praw publicznych (w tym zarówno obywatele RP, jak i cudzoziemcy, niezależnie od miejsca zamieszkania), która złoży pisemne oświadczenie o przystąpieniu do Stowarzyszenia oraz akceptacji niniejszego Regulaminu.

2. O przyjęciu lub odmowie przyjęcia do Stowarzyszenia decyduje Przedstawiciel. O podjętej decyzji kandydat na członka jest informowany pisemnie w terminie 7 dni, licząc od dnia złożenia oświadczenia.

3. W przypadku odmowy przyjęcia do Stowarzyszenia przysługuje odwołanie do Walnego Zebrania Członków w terminie 14 dni od daty dostarczenia decyzji o odmowie przyjęcia do Stowarzyszenia. Odwołanie składa się za pośrednictwem Przedstawiciela.

4. Utrata członkostwa następuje w przypadku: a) śmierci członka, b) pisemnej rezygnacji złożonej na ręce Przedstawiciela, c) utraty pełnej zdolności do czynności prawnych, d) utraty praw publicznych, e) wykluczenia członka Stowarzyszenia z powodu: - niepłacenia składek członkowskich przez okres 6 miesięcy, - nieprzestrzegania uchwał władz Stowarzyszenia oraz postanowień niniejszego Regulaminu.

5. Uchwałę w przedmiocie wykluczenia członka ze Stowarzyszenia podejmuje Walne Zebranie Członków.

6. Uchwała Walnego Zebrania Członków w przedmiocie wykluczenia Członka Stowarzyszenia jest ostateczna.

7. Członkowie Stowarzyszenia mają obowiązek regularnego opłacania składek członkowskich, których wysokość i zasady uiszczania ustala Walne Zebranie Członków.

## § 5

1. Władzami Stowarzyszenia są: a) Walne Zebranie Członków, b) Przedstawiciel.

2. Najwyższą władzą Stowarzyszenia jest Walne Zebranie Członków, które stanowią wszyscy członkowie Stowarzyszenia.

3. Walne Zebranie Członków może być zwyczajne lub nadzwyczajne.

4. Zwyczajne Walne Zebranie zwoływane jest przez Przedstawiciela co najmniej raz na rok.

5. Nadzwyczajne Walne Zebranie zwołuje Przedstawiciel: a) z własnej inicjatywy, b) na pisemny, uzasadniony wniosek co najmniej 1/3 członków Stowarzyszenia.

6. Nadzwyczajne Walne Zebranie winno być zwołane w ciągu 30 dni od daty złożenia wniosku.

7. Nadzwyczajne Walne Zebranie obraduje wyłącznie nad sprawami, dla rozpatrzenia których zostało zwołane.

## § 6

1. Walne Zebranie Członków właściwe jest do podejmowania decyzji we wszystkich sprawach Stowarzyszenia, za wyjątkiem spraw zastrzeżonych niniejszym Regulaminem do kompetencji Przedstawiciela.

2. Do wyłącznych kompetencji Walnego Zebrania Członków należy w szczególności: a) wybór i odwołanie Przedstawiciela Stowarzyszenia, b) przyjęcie i uchwalanie zmian Regulaminu, c) kontrola działań podjętych przez Przedstawiciela, d) uchwalanie głównych kierunków i programów działania Stowarzyszenia, e) wykluczanie członków ze Stowarzyszenia, f) podjęcie uchwały w sprawie rozwiązania Stowarzyszenia, g) ustalanie wysokości składki członkowskiej, h) rozpatrywanie skarg członków Stowarzyszenia na działalność Przedstawiciela.

3. Uchwały Walnego Zebrania Członków Stowarzyszenia, o ile regulamin nie stanowi inaczej, podejmowane są zwykłą większością głosów, przy obecności: a) w pierwszym terminie – co najmniej połowy uprawnionych do głosowania członków, b) w drugim terminie – wyznaczonym w tym samym dniu, 30 minut później niż pierwszy termin – bez względu na liczbę osób uprawnionych do głosowania.

4. Uchwała o odwołaniu Przedstawiciela przed upływem jego kadencji wymaga podjęcia przez Walne Zebranie Członków większością co najmniej 3/4 głosów wszystkich członków Stowarzyszenia.

## § 7

1. Stowarzyszenie reprezentuje Przedstawiciel.

2. Przedstawiciel Stowarzyszenia jest wybierany przez Walne Zebranie Członków spośród członków Stowarzyszenia, którzy wyrazili zgodę na kandydowanie.

3. Kadencja Przedstawiciela Stowarzyszenia trwa 3 lata.

4. Do kompetencji Przedstawiciela należy: a) przyjmowanie członków Stowarzyszenia, b) wykonywanie uchwał Walnego Zebrania Członków, c) reprezentowanie Stowarzyszenia na zewnątrz i działanie w jego imieniu, d) zwoływanie Walnego Zebrania Członków.

## § 8

Stowarzyszenie uzyskuje środki na działalność ze składek członkowskich, darowizn, spadków, zapisów, dochodów z majątków Stowarzyszenia, ofiarności publicznej (zbiórek) oraz dotacji.

## § 9

1. Środkami finansowymi Stowarzyszenia zarządza Przedstawiciel, zgodnie z obowiązującymi przepisami prawa, niniejszym Regulaminem oraz uchwałami Walnego Zebrania Członków.

2. Podejmowanie przez Przedstawiciela czynności przekraczających zakres zwykłego zarządu wymaga uprzedniej zgody wszystkich członków Stowarzyszenia oraz udzielenia przez nich pełnomocnictwa do dokonania tych czynności.

3. Czynnościami przekraczającymi zakres zwykłego zarządu są: a) nabycie oraz zbycie nieruchomości lub prawa użytkowania wieczystego, b) ustanowienie ograniczonego prawa rzeczowego, c) zawarcie umowy kredytu albo pożyczki, d) przejęcie długu, uznanie długu, zwolnienie z długu, przystąpienie do długu, zawarcie umowy poręczenia lub zawarcie innej podobnej umowy, e) zaciągnięcie innych zobowiązań przekraczających wartość 10 000 zł.

## § 10

Decyzję w sprawie zmiany regulaminu oraz rozwiązania stowarzyszenia podejmuje Walne Zebranie Członków większością co najmniej 2/3 głosów przy obecności co najmniej połowy członków uprawnionych do głosowania. Podejmując uchwałę o rozwiązaniu Stowarzyszenia Walne Zebranie Członków określa przeznaczenie pozostałych środków majątkowych Stowarzyszenia.$regulamin_pl$, false),
  ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000601', 'uk',
   'Регламент діяльності звичайного товариства',
   $rehlament_uk$Звичайне товариство «Barykady Kultury»

## § 1

1. Товариство має назву Звичайне товариство «Barykady Kultury», надалі в регламенті іменується «Товариство».

2. Товариство є добровільним, самоврядним, постійним об'єднанням з некомерційною метою, яке не має статусу юридичної особи.

3. Товариство є звичайним товариством (stowarzyszenie zwykłe) у розумінні закону «Право про асоціації».

4. Основою діяльності Товариства є положення Закону від 7 квітня 1989 р. «Право про асоціації» та положення цього Регламенту.

5. Територією діяльності Товариства є територія Республіки Польща, з особливим акцентом на місто Познань.

6. Місцезнаходженням (штаб-квартирою) Товариства є місто Познань.

7. Мовами комунікації та документації всередині Товариства є польська, українська та англійська.

## § 2

Цілі діяльності Товариства:

1. Культурна дипломатія: виконання ролі "культурного мосту" між українцями, поляками та міжнародною спільнотою.

2. Неформальна, просвітницька та виховна освіта: популяризація знань, розвиток м'яких та громадянських навичок, а також підвищення обізнаності молоді щодо демократичних політичних процесів.

3. Розвиток критичного мислення та протидія пропаганді і дезінформації.

4. Захист прав людини, підтримка гендерної рівності, захист прав жінок та гідності мігрантів і біженців.

5. Інтеграція та підтримка: діяльність на користь національних та етнічних меншин, підтримка адаптаційних процесів українців та інших іноземців у Польщі.

6. Національна спадщина та історична пам'ять: захист культурних цінностей та відновлення і плекання історичної пам'яті, з особливим акцентом на догляд за українскими могилами та місцями пам'яті в Польщі.

7. Охорона довкілля: ініціювання та підтримка досліджень щодо впливу російської війни на екологію.

8. Промоція та організація волонтерства, а також благодійна діяльність.

9. Промоція та популяризація української культури в Польщі та у світі.

10. Ініціювання публічних акцій, зібрань та протестів на захист прав людини та демократичних цінностей.

## § 3

Товариство реалізує свої цілі шляхом:

1. Видання та розповсюдження журналів, публікацій, а також ведення широкої інформаційної та видавничої діяльності.

2. Організації тренінгів, воркшопів, семінарів та конференцій на різноманітну тематику, що відповідає на актуальні суспільні виклики (зокрема протидія дезінформації, особистісний розвиток, психологія, громадянські права).

3. Організації та проведення мовних курсів, що полегшують адаптацію та інтеграцію іноземців у Польщі.

4. Ініціювання та реалізації заходів щодо реставрації, інвентаризації та догляду за українськими могилами та місцями історичної пам'яті на території Польщі.

5. Роботи з молоддю та тісної співпраці з освітніми закладами, зокрема школами та університетами.

6. Проведення досліджень та аналітичних проєктів, що стосуються впливу російської збройної агресії на екологію та навколишнє середовище.

7. Проведення і публікації інтерв'ю та документування соціального досвіду біженців і мігрантів.

8. Організації соціальних кампаній, мистецьких та благодійних заходів.

9. Співпраці з місцевим самоврядуванням, державними органами, медіа, а також польськими та міжнародними неурядовими організаціями.

10. Організації культурних заходів, виставок, концертів, дискусійних форумів, показів фільмів та фестивалів.

11. Організації та участі у легальних публічних зібраннях, соціальних акціях, маршах та протестах.

## § 4

1. Членом Товариства може бути фізична особа, яка має повну дієздатність та не позбавлена публічних прав (включно з громадянами Польщі та іноземцями, незалежно від місця їхнього проживання), яка подасть письмову заяву про вступ до Товариства та акцептує цей Регламент.

2. Рішення про прийняття або відмову у прийнятті до Товариства приймає Представник. Про прийняте рішення кандидат у члени інформується письмово протягом 7 днів з моменту подання заяви.

3. У разі відмови у прийнятті до Товариства, є можливість подати апеляцію до Загальних зборів членів протягом 14 днів з дати отримання рішення про відмову. Апеляція подається через Представника.

4. Втрата членства відбувається у разі: a) смерті члена, b) письмової заяви про вихід, поданої Представнику, c) втрати повної дієздатності, d) втрати публічних прав, e) виключення члена Товариства з причини: - несплати членських внесків протягом 6 місяців, - недотримання резолюцій органів Товариства та положень цього Регламенту.

5. Резолюцію про виключення члена з Товариства приймають Загальні збори членів.

6. Резолюція Загальних зборів членів щодо виключення члена є остаточною.

7. Члени Товариства зобов'язані регулярно сплачувати членські внески, розмір та правила сплати яких встановлюють Загальні збори членів.

## § 5

1. Органами управління Товариства є: a) Загальні збори членів (Walne Zebranie Członków), b) Представник (Przedstawiciel).

2. Найвищим органом управління Товариства є Загальні збори членів, до складу яких входять усі члени Товариства.

3. Загальні збори членів можуть бути черговими або позачерговими.

4. Чергові Загальні збори скликаються Представником щонайменше один раз на рік.

5. Позачергові Загальні збори скликає Представник: a) за власною ініціативою, b) на письмову, обґрунтовану вимогу щонайменше 1/3 членів Товариства.

6. Позачергові Загальні збори мають бути скликані протягом 30 днів з дати подання вимоги.

7. Позачергові Загальні збори розглядають виключно ті питання, для вирішення яких вони були скликані.

## § 6

1. Загальні збори членів мають право приймати рішення з усіх питань діяльності Товариства, за винятком питань, віднесених цим Регламентом до компетенції Представника.

2. До виключної компетенції Загальних зборів членів належить, зокрема: a) вибір та відкликання Представника Товариства, b) прийняття та затвердження змін до Регламенту, c) контроль за діями Представника, d) ухвалення основних напрямків та програм діяльності Товариства, e) виключення членів з Товариства, f) прийняття резолюції про ліквідацію Товариства, g) встановлення розміру членських внесків, h) розгляд скарг членів Товариства на діяльність Представника.

3. Резолюції Загальних зборів членів, якщо регламент не передбачає іншого, приймаються простою більшістю голосів, за присутності: a) у перший термін – щонайменше половини членів, які мають право голосу, b) у другий термін – призначений у той самий день, на 30 хвилин пізніше першого терміну – незалежно від кількості осіб, які мають право голосу.

4. Резолюція про дострокове відкликання Представника (до закінчення терміну його повноважень) вимагає згоди щонайменше 3/4 голосів усіх членів Товариства.

## § 7

1. Товариство представляє Представник.

2. Представник Товариства обирається Загальними зборами членів з числа членів Товариства, які висловили згоду балотуватися.

3. Каденція (строк повноважень) Представника Товариства триває 3 роки.

4. До компетенції Представника належить: a) прийняття членів до Товариства, b) виконання резолюцій Загальних зборів членів, c) представництво Товариства назовні та діяльність від його імені, d) скликання Загальних зборів членів.

## § 8

Товариство отримує кошти на діяльність з членських внесків, пожертвувань, спадщини, заповітів, доходів від майна Товариства, публічних зборів (ofiarność publiczna) та грантів (дотацій).

## § 9

1. Фінансовими ресурсами Товариства управляє Представник, відповідно до чинного законодавства, цього Регламенту та резолюцій Загальних зборів членів.

2. Здійснення Представником дій, що виходять за межі звичайного управління (zwykły zarząd), вимагає попередньої згоди всіх членів Товариства та надання ними довіреності на здійснення цих дій.

3. Діями, що виходять за межі звичайного управління, є: a) придбання та відчуження нерухомості або права довічного користування, b) встановлення обмеженого речового права, c) укладення кредитного договору або договору позики, d) прийняття боргу, визнання боргу, звільнення від боргу, приєднання до боргу, укладення договору поруки або іншого подібного договору, e) взяття інших зобов'язань, що перевищують вартість 10 000 злотих.

## § 10

Рішення про зміну регламенту та ліквідацію товариства приймають Загальні збори членів більшістю не менше ніж 2/3 голосів за присутності не менше половини членів, які мають право голосу. Приймаючи резолюцію про ліквідацію Товариства, Загальні збори членів визначають призначення залишкових майнових ресурсів Товариства.$rehlament_uk$, false)
on conflict (id) do nothing;
