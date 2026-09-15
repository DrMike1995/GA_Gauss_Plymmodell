# Spridningslabbet · interaktiv I-131-modell

> Detta är en förenklad pedagogisk modell för scenariojämförelser. Den är inte validerad för prognoser, strålskyddsbeslut eller operativ beredskap vid en verklig kärnteknisk olycka.

## Öppna sidan

Öppna `dist/index.html` i en webbläsare. Ingen installation eller byggprocess behövs.
Internet krävs för Leaflet, kartbakgrunden från OpenStreetMap och det valfria Google-typsnittet.
Om Leaflet inte laddas visas en lokal schematisk sektor. Vid fel på kartbilderna fungerar fortfarande kartans sektor och alla beräkningar. Systemtypsnitt används om webbtypsnittet inte laddas.

## Lägg upp på GitHub Pages

1. Skapa ett nytt repository på GitHub.
2. Ladda upp **innehållet i `dist`** till repositoryts rot: `index.html`, `style.css`, `model.js`, `app.js` och `.nojekyll`.
3. Öppna **Settings → Pages**. Välj **Deploy from a branch**, grenen **main**, mappen **/(root)** och spara.
4. När GitHub har publicerat sidan visas dess webbadress under Pages.

Alla lokala länkar är relativa och fungerar även på `användare.github.io/repository/`.
Färdiga uppladdningsfiler finns också i `i131-website-github.zip` i den överordnade projektmappen.
Sidan har inte automatiskt laddats upp till ditt GitHub-konto.

[GitHubs instruktioner](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Reglage och karta

- Vindhastighet: 2–10 m/s, exakt 1 m/s per steg.
- Vindriktning, utsläpps-/transporttid, sektorvinkel, vindvariation och maximal radie ändrar geometrin direkt vid `input`-händelser, även medan reglaget dras.
- Pasquill A–F väljer illustrativa grundvinklar. Ändrad vinkel manuellt väljer ”Egen sektorvinkel”.
- Vindvariation anges som ± grader. Gränssnittet omvandlar ±30° till 60° extra sektorbredd.
- Aktivitet, torrdeposition och regn växlar kartans färg till markbeläggning.
- Blandningshöjd växlar färgen till luftkoncentration.
- Andning, exponering, avresa och inomhusfaktor växlar färgen till effektiv inhalationsdos.
- Doskoefficienter är redigerbara talfält. Felaktig inmatning behåller senast giltiga resultat och visar ett fel.
- Kartans färgmått kan också väljas manuellt. Färgskalan är fast och logaritmisk för varje storhet, klipps vid markerat maxvärde och visar inga riskklassningar. De exakta värdena finns i siffror.
- Kartans zoom ligger kvar medan reglagen används så att storleksändringen syns. ”Visa hela sektorn” anpassar kartutsnittet vid behov. Panorera och zooma med kartkontrollerna eller pekgester.
- Återställ återgår till Pythonmodellens basfall.

Reglagen går även att styra med tangentbordets piltangenter. Alla resultat räknas om i webbläsaren. Ingen backend eller datalagring används.

## Fysik

`dist/model.js` innehåller en direkt JavaScript-version av Pythonmodellens statiska formler.
Indata i timmar, km, TBq och m³/h konverteras till SI vid beräkningen.

```text
R = min(v × t, R_max)
theta = min(360, grundvinkel + extra total bredd) × pi / 180
A = theta / 2 × R²
f = clamp(torrandel + regnandel, 0, 1)
Q_mark = Q_total × f
Q_luft = Q_total − Q_mark
markbeläggning = Q_mark / A
C_luft = Q_luft / (A × blandningshöjd)
t_eff = min(exponeringstid, tid tills avresa)
Q_inandad = C_luft × andningshastighet × t_eff × inomhusfaktor
dos_Sv = Q_inandad × respektive koefficient
dos_mSv = dos_Sv × 1000
```

Geometrin ändras bara av parametrar som ingår i geometriformlerna. Exempelvis ändrar andning dosen och kartans dosfärg, men inte spridningsområdets storlek. Radietaket eller noll aktivitet kan innebära att vissa reglage inte ändrar resultatet; det följer modellen.

Källterm och doskoefficienter är illustrativa. Alla förenklingar och källor beskrivs på hemsidan. Ingen Gaussisk plym, sönderfall, verklig plympassage eller extern stråldos ingår. Utsläppshöjd 50 m påverkar inte MVP:n.

Kartgeometrin använder storcirkelpunkter på en sfär med radie 6 371 000 m. Resultatets area använder den ursprungliga plana sektorformeln. Ringhals approximeras med 57,259722 N, 12,110833 E. Kartan är en geografisk illustration, inte en prognos.

## Kontrollera koden

Med Node.js installerat, kör från `i131-website`:

```text
node --test test-model.cjs
node --check dist/app.js
```

Testerna jämför basfallet med Pythonresultaten, alla vindsteg, vinklar, deposition, dos, aktivitetsbudget och kartans vindkonvention.

## Externa tjänster

Leaflet 1.9.4 laddas från unpkg. Kartbilder laddas från OpenStreetMap med synlig attribution. Google Fonts är valfritt för utseendet. Dessa tjänster får vanliga webbförfrågningar vid besök. Ingen API-nyckel krävs. Vid större trafik behöver du följa [OpenStreetMaps tile-policy](https://operations.osmfoundation.org/policies/tiles/) och välja passande kartleverantör. Ingen förhämtning eller offlinehämtning av kartbilder görs.
