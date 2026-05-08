# 🎓 EduSync — Multiplatform Educational Platform (LMS)

---

## 📌 Opis projektu

EduSync to nowoczesna platforma edukacyjna klasy LMS (Learning Management System), zaprojektowana jako wieloplatformowe rozwiązanie dla szkół średnich i uczelni wyższych.

Celem projektu jest stworzenie lekkiego, skalowalnego systemu, który integruje wszystkie procesy edukacyjne w jednym środowisku — od zarządzania kursami, przez zadania, aż po komunikację.

---

## 🎯 Główne funkcjonalności

* zarządzanie kursami i materiałami dydaktycznymi
* system zadań i ocen
* autoryzacja użytkowników (student, wykładowca, administrator)
* komunikacja wewnętrzna
* system powiadomień
* dostęp wieloplatformowy (mobile + web)

---

## 🏗️ Architektura systemu

Projekt oparty jest na **architekturze warstwowej (layered architecture)**:

* **Frontend** — Flutter (mobile + web)
* **Backend API** — FastAPI (Python)
* **Infrastruktura** — Docker + Git + AWS
* **Testowanie** — Pytest
* **Baza danych** — PostgreSQL

Architektura typu **client–server + API-first** umożliwia niezależny rozwój komponentów.

---

## 📁 Struktura projektu

```text
EduSYNC/
├── .github/workflows/     # konfiguracja CI/CD
├── db/                    # pliki związane z bazą danych
├── e2e/                   # testy end-to-end
├── infra/docker/          # pliki Docker dla infrastruktury
├── mobile_app/            # aplikacja mobilna Flutter
├── src/                   # kod aplikacji 
├── tests/                 # testy automatyczne
├── docker-compose.yml     # konfiguracja uruchomienia lokalnego
├── package.json           # zależności i skrypty 
└── README.md
```

---

## ⚙️ Technologie

* **Frontend:** Flutter (Dart)
* **Backend:** Python + FastAPI
* **Database:** PostgreSQL
* **DevOps:** Docker, GitHub Actions, AWS
* **Testy:** Pytest

---

## 🚀 Instalacja i uruchomienie

### Wymagania:

* Docker
* Docker Compose
* Git

---

### 1. Klonowanie repozytorium

```bash
git clone https://github.com/your-repo/edusync.git
cd edusync
```

---

### 2. Uruchomienie aplikacji

```bash
docker compose up --build
```

---

### 3. Dostęp do API

```text
http://localhost:8000/docs
```

Swagger UI umożliwia testowanie endpointów.

---

## 🧪 Testowanie

Strategia testowania obejmuje:

### 🔹 Testy jednostkowe

* walidacja logiki backendu
* modele danych
* autoryzacja

### 🔹 Testy integracyjne

* API ↔ PostgreSQL
* JWT ↔ endpointy

### 🔹 Testy E2E

* logowanie użytkownika
* przegląd kursów
* przesyłanie zadań

---

### Uruchamianie testów

```bash
python test_basic.py
```

---

## 🔐 Autoryzacja

System wykorzystuje **JWT (JSON Web Token)**:

* stateless authentication
* brak przechowywania sesji
* kompatybilność z API-first

---

## ⚙️ CI/CD

Pipeline CI/CD realizowany za pomocą **GitHub Actions**.

### 🔄 Kroki pipeline'u:

1. Checkout repozytorium
2. Instalacja zależności
3. Lint / analiza statyczna
4. Testy automatyczne
5. Build Docker
6. Testy integracyjne
7. (opcjonalnie) deploy na staging

Pipeline uruchamia się automatycznie przy każdym:

* push
* pull request

---

## 📊 Metryki (aktualny stan)

* testy jednostkowe: ✔
* testy integracyjne: ✔
* testy E2E: ✔
* pokrycie kodu: ~70%

---

## ⚠️ Ograniczenia

* brak pełnego frontend UI (demo struktura)
* brak integracji z systemami zewnętrznymi

---

## 🔮 Możliwy rozwój

* pełna aplikacja Flutter
* system powiadomień real-time
* integracja z AWS (S3, EC2)
* AI / analiza postępów studentów

---

## 👨‍💻 Zespół

Projekt zespołowy EduSync

* Albert Arakelian - Lead / Architekt
* Andrii Stefanets - Backend Developer
* Tsimafei Dolnikau - DevOps / Tester

---

## 📄 Status projektu

Projekt w fazie prototypowej (academic project)
Gotowy do dalszej implementacji i rozwoju.

---

# ✅ Podsumowanie

EduSync to skalowalna, wieloplatformowa platforma edukacyjna,
zaprojektowana zgodnie z nowoczesnymi standardami architektonicznymi i DevOps.
