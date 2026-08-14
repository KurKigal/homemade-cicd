# Homemade CI/CD

> GitHub üzerinde çalışan CI/CD süreçlerini kod veya YAML yazmadan oluşturmak, yönetmek ve gözlemlemek için geliştirilen kişisel, local-first CI/CD kontrol paneli.

Homemade CI/CD, GitHub Actions altyapısını kullanan ancak günlük kullanımda GitHub Actions YAML dosyaları, runner tanımları, workflow syntax'ı ve tekrarlayan CI/CD konfigürasyonlarıyla doğrudan uğraşma ihtiyacını ortadan kaldırmayı hedefleyen bir projedir.

Projenin temel fikri oldukça basittir:

```text
Repository seç
      ↓
Proje türünü otomatik algıla
      ↓
CI/CD seçeneklerini arayüzden seç
      ↓
Workflow'u otomatik üret
      ↓
GitHub repository'ye yaz
      ↓
GitHub Actions çalıştırsın
```

Kullanıcı açısından:

```text
☑ Analyze
☑ Tests
☑ Android APK
☑ Android AAB
☑ iOS Build

Branch: main

Triggers:
☑ Push
☑ Pull Request
☑ Manual

[ Create Pipeline ]
```

Arka planda ise Homemade CI/CD bu konfigürasyonu GitHub Actions workflow'una dönüştürür:

```text
PipelineConfig
      ↓
Workflow Generator
      ↓
.github/workflows/homemade-ci.yml
      ↓
GitHub API
      ↓
GitHub Actions
      ↓
Runner
```

İlk sürüm yalnızca **kişisel kullanım** için geliştirilmektedir.

Bu nedenle şu anda:

- kullanıcı kayıt sistemi yoktur,
- OAuth tabanlı multi-user authentication yoktur,
- takım/workspace sistemi yoktur,
- abonelik sistemi yoktur,
- ayrı cloud backend zorunluluğu yoktur.

GitHub bağlantısı local backend'de saklanan kişisel bir GitHub token üzerinden yapılmaktadır.

Uzun vadede sistemin SaaS veya çok kullanıcılı bir ürüne dönüştürülebilmesi düşünülerek mimari katmanlar birbirinden ayrılmıştır.

---

# İçindekiler

- [Projenin Amacı](#projenin-amacı)
- [Temel Tasarım İlkeleri](#temel-tasarım-ilkeleri)
- [Mevcut Özellikler](#mevcut-özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Sistem Mimarisi](#sistem-mimarisi)
- [Monorepo Yapısı](#monorepo-yapısı)
- [Frontend Mimarisi](#frontend-mimarisi)
- [Backend Mimarisi](#backend-mimarisi)
- [Shared Core Paketi](#shared-core-paketi)
- [GitHub Entegrasyonu](#github-entegrasyonu)
- [Project Detector](#project-detector)
- [Pipeline Sistemi](#pipeline-sistemi)
- [Flutter Workflow Generator](#flutter-workflow-generator)
- [Node.js Workflow Generator](#nodejs-workflow-generator)
- [Android Pipeline](#android-pipeline)
- [iOS Pipeline](#ios-pipeline)
- [Workflow'un GitHub'a Yazılması](#workflowun-githuba-yazılması)
- [API Endpoint'leri](#api-endpointleri)
- [Development Ortamı](#development-ortamı)
- [pnpm Workspace Yapısı](#pnpm-workspace-yapısı)
- [Kullanılan Önemli Komutlar](#kullanılan-önemli-komutlar)
- [Environment Variables](#environment-variables)
- [Güvenlik](#güvenlik)
- [Git Stratejisi](#git-stratejisi)
- [Refactor Süreci](#refactor-süreci)
- [Mevcut Veri Akışı](#mevcut-veri-akışı)
- [Test Stratejisi](#test-stratejisi)
- [Bilinen Sınırlamalar](#bilinen-sınırlamalar)
- [Roadmap](#roadmap)
- [Uzun Vadeli Mimari](#uzun-vadeli-mimari)

---

# Projenin Amacı

CI/CD sistemleri son derece güçlüdür fakat basit bir uygulama için bile çoğunlukla aşağıdaki kavramlarla uğraşmayı gerektirir:

```text
.github/workflows
YAML
jobs
steps
runs-on
workflow_dispatch
pull_request
push
artifacts
secrets
runner
matrix
permissions
```

Örneğin basit bir Flutter uygulamasının:

- kod analizini yapmak,
- testlerini çalıştırmak,
- Android APK oluşturmak,
- Android AAB oluşturmak,
- iOS build almak,

için developer'ın GitHub Actions workflow syntax'ını bilmesi gerekir.

Homemade CI/CD bu katmanı soyutlar.

Developer:

```text
Ne istiyorum?
```

sorusunu cevaplar.

Homemade CI/CD ise:

```text
GitHub Actions bunu nasıl yapmalı?
```

sorusunu çözer.

Bu nedenle proje bir CI/CD engine olmaktan ziyade:

> **GitHub Actions üzerinde çalışan bir CI/CD orchestration ve abstraction layer**

olarak düşünülebilir.

---

# Temel Tasarım İlkeleri

Projenin geliştirilmesinde birkaç temel prensip kullanılmaktadır.

## 1. No-code günlük kullanım

Homemade CI/CD kullanılırken normal durumda:

- YAML yazılmamalı,
- shell komutları yazılmamalı,
- GitHub Actions syntax'ı bilinmemeli.

Kullanıcı yalnızca arayüz üzerinden pipeline davranışını seçmelidir.

---

## 2. GitHub altyapısını yeniden icat etmemek

Homemade CI/CD kendi:

- runner altyapısını,
- artifact storage sistemini,
- Git server'ını,
- workflow execution engine'ini

oluşturmaz.

Bunun yerine GitHub'ın mevcut altyapısını kullanır.

```text
Homemade CI/CD
      ↓
GitHub API
      ↓
GitHub Actions
      ↓
GitHub Runner
```

Homemade CI/CD'nin görevi **orchestration** katmanıdır.

---

## 3. Local-first

İlk sürüm yalnızca geliştiricinin kendi bilgisayarında kullanılmaktadır.

```text
Browser
   ↓
localhost:5173
   ↓
Local Fastify API
   ↓
GitHub API
```

Bu nedenle şu anda ayrı bir production backend veya hosting gerekmemektedir.

---

## 4. Tek kullanıcı, minimum gereksiz altyapı

İlk sürümde özellikle eklenmeyen sistemler:

```text
Authentication
OAuth
User database
Organization management
Billing
Subscriptions
Team permissions
Cloud deployment
Redis
Message queues
Docker orchestration
```

İhtiyaç oluşmadan altyapı eklenmemektedir.

---

## 5. Gelecekte SaaS'a dönüşebilir mimari

Her ne kadar ilk kullanım kişisel olsa da kod doğrudan tek kullanıcılı script şeklinde yazılmamaktadır.

Örneğin:

```text
UI
API
Domain contracts
GitHub adapter
Project detector
Workflow generator
```

birbirinden ayrılmıştır.

Böylece ileride:

```text
Personal local application
          ↓
GitHub OAuth
          ↓
Multi-user backend
          ↓
Database
          ↓
SaaS
```

dönüşümü yapılabilir.

---

# Mevcut Özellikler

Uygulama şu anda Flutter ve Node.js repository'leri için uçtan uca pipeline oluşturma, mevcut pipeline'ları yönetme ve GitHub Actions çalışmalarını izleme akışını desteklemektedir:

```text
GitHub bağlantısı
      ↓
Repository listesi
      ↓
Repository seçimi
      ↓
Repository analizi
      ↓
Project type ve package manager detection
      ↓
Flutter / Node.js pipeline builder
      ↓
Workflow preview
      ↓
GitHub workflow oluşturma/güncelleme
```

Mevcut özellikler:

### GitHub

- Authenticated GitHub kullanıcısını getirme
- Kullanıcının repository'lerini listeleme
- Private repository desteği
- Public repository desteği
- Default branch bilgisi
- Repository dili
- Repository metadata bilgileri

### Repository Inspector

Şu proje türleri algılanabilir:

- Flutter
- Node.js
- React
- React + Vite
- Next.js
- NestJS
- Fastify
- Express
- Python
- Unknown project

### Flutter

Algılanabilen platformlar:

- Android
- iOS
- Web

### Node.js

- `package.json` script'lerini algılama
- pnpm, npm, yarn ve Bun lockfile algılama
- lockfile bulunmadığında güvenli npm varsayılanı
- seçilebilir Node.js sürümü
- frozen lockfile kurulumu
- lint, typecheck, test ve build görevleri

### CI/CD

Flutter için:

- `flutter analyze`
- `flutter test`
- Android APK
- Android AAB
- unsigned iOS build

Node.js için:

- package manager'a uygun dependency kurulumu
- `lint`, `typecheck`, `test` ve `build` script'lerini ayrı ayrı çalıştırma
- pnpm, npm, yarn ve Bun desteği

### Trigger

- push
- pull request
- manual dispatch

### Workflow işlemleri

- YAML preview
- yeni workflow oluşturma
- mevcut workflow'u güncelleme
- repository workflow'larını listeleme
- workflow detayını ve YAML içeriğini görüntüleme
- Homemade tarafından yönetilen pipeline'ı etkinleştirme, devre dışı bırakma ve silme
- workflow run listesi, job detayları, manual dispatch, re-run ve cancel
- run artifact'lerini listeleme ve indirme

Workflow dosyası:

```text
.github/workflows/homemade-ci.yml
```

---

# Teknoloji Yığını

## Dil

```text
TypeScript
```

Frontend ve backend aynı dili kullanmaktadır.

Bu sayede shared domain model'leri frontend/backend arasında paylaşılabilmektedir.

---

## Frontend

```text
React
Vite
TypeScript
Tailwind CSS
TanStack Query
Lucide React
```

### React

UI component sistemi.

### Vite

Development server ve frontend tooling.

### Tailwind CSS

UI styling.

### TanStack Query

Server state yönetimi.

Örneğin:

```text
GitHub user
Repositories
Repository inspection
```

gibi backend'den gelen veriler React local state yerine Query üzerinden yönetilmektedir.

### Lucide React

UI ikonları.

---

# Backend

```text
Node.js 24
Fastify
TypeScript
Octokit
Zod
YAML
tsx
```

### Fastify

HTTP API server.

### Octokit

GitHub REST API client.

### Zod

Runtime validation ve ortak domain schema'ları.

### YAML

Internal pipeline config'in GitHub Actions workflow YAML'ına çevrilmesi.

### tsx

TypeScript backend'in development sırasında doğrudan çalıştırılması.

---

# Package Manager

```text
pnpm
```

Proje bir pnpm workspace/monorepo olarak yapılandırılmıştır.

---

# Sistem Mimarisi

Genel mimari:

```text
                       USER
                         │
                         ▼
                 React Application
                         │
                         │ HTTP
                         ▼
                  Fastify Backend
                         │
            ┌────────────┼─────────────┐
            │            │             │
            ▼            ▼             ▼
      Project       Pipeline       GitHub
      Detector      Services       Services
            │            │             │
            └────────────┼─────────────┘
                         ▼
                   GitHub Adapter
                         │
                         ▼
                      Octokit
                         │
                         ▼
                    GitHub API
                         │
            ┌────────────┼─────────────┐
            ▼            ▼             ▼
          Repos        Actions       Contents
```

Shared contracts:

```text
              @homemade-cicd/core
                       │
               ┌───────┴───────┐
               ▼               ▼
              WEB             API
```

---

# Monorepo Yapısı

Proje pnpm workspace kullanmaktadır.

Genel yapı:

```text
homemade-cicd/
│
├── apps/
│   │
│   ├── web/
│   │
│   └── api/
│
├── packages/
│   │
│   └── core/
│
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── .gitignore
└── README.md
```

Üç ayrı workspace package bulunmaktadır:

```text
web
api
@homemade-cicd/core
```

---

# `apps/web`

Frontend uygulamasıdır.

Mevcut feature-oriented yapı:

```text
apps/web/src/
│
├── features/
│   │
│   ├── pipelines/
│   │   ├── PipelineBuilder.tsx
│   │   ├── NodePipelineBuilder.tsx
│   │   └── PipelineWorkflowCard.tsx
│   │
│   ├── project-analysis/
│   │   └── ProjectAnalysisPanel.tsx
│   │
│   ├── repositories/
│   │   ├── RepositoryCard.tsx
│   │   ├── RepositoryList.tsx
│   │   ├── RepositorySearch.tsx
│   │   └── types.ts
│   │
│   └── runs/
│       ├── JobsSection.tsx
│       ├── RunActions.tsx
│       └── WorkflowRunCard.tsx
│
├── layouts/
│   └── AppLayout.tsx
│
├── pages/
│   ├── PipelinesPage.tsx
│   ├── ProjectsPage.tsx
│   ├── RunDetailPage.tsx
│   └── RunsPage.tsx
│
├── lib/
│   └── api.ts
│
├── App.tsx
├── main.tsx
└── index.css
```

---

# `apps/api`

Backend uygulamasıdır.

Genel yapı:

```text
apps/api/src/
│
├── adapters/
│   └── github/
│       └── github-adapter.ts
│
├── config/
│   └── env.ts
│
├── lib/
│   └── github.ts
│
├── routes/
│   ├── artifacts.ts
│   ├── github.ts
│   ├── pipelines.ts
│   ├── runs.ts
│   └── validation.ts
│
├── services/
│   │
│   ├── artifacts/
│   │   └── artifacts-service.ts
│   │
│   ├── github/
│   │   └── github-service.ts
│   │
│   ├── repositories/
│   │   └── repository-reader.ts
│   │
│   ├── pipelines/
│   │   ├── managed-workflow-generator.ts
│   │   ├── managed-workflow-parser.ts
│   │   ├── node-workflow-generator.ts
│   │   ├── node-workflow-parser.ts
│   │   ├── pipeline-management-service.ts
│   │   ├── pipeline-service.ts
│   │   ├── workflow-generator.ts
│   │   └── workflow-parser.ts
│   │
│   ├── runs/
│   │   └── runs-service.ts
│   │
│   ├── project-analysis-service.ts
│   └── project-detector.ts
│
├── app.ts
└── server.ts
```

---

# `packages/core`

Frontend ve backend tarafından ortak kullanılan domain contract'larını içerir.

```text
packages/core/
│
├── src/
│   ├── github.ts
│   ├── project.ts
│   ├── pipeline.ts
│   └── index.ts
│
├── package.json
└── tsconfig.json
```

Package adı:

```text
@homemade-cicd/core
```

Frontend:

```ts
import type {
  Repository,
  FlutterPipelineConfig,
  NodePipelineConfig,
  ManagedPipelineConfig,
} from "@homemade-cicd/core";
```

Backend:

```ts
import {
  managedPipelineSchema,
} from "@homemade-cicd/core";
```

kullanabilir.

---

# Frontend Mimarisi

Frontend ilk aşamada büyük ölçüde tek bir `App.tsx` içerisinde geliştirilmiştir.

İlk çalışan milestone sonrasında component büyümeye başladığı için feature-oriented refactor yapılmıştır.

Önce:

```text
App.tsx
├── sidebar
├── header
├── GitHub queries
├── search
├── repository list
├── repository card
├── project analysis
└── pipeline builder
```

bulunuyordu.

Refactor sonrası:

```text
App
 ├── ProjectsPage
 │   ├── RepositoryList
 │   └── ProjectAnalysisPanel
 │       ├── PipelineBuilder
 │       └── NodePipelineBuilder
 ├── RunsPage
 │   └── RunDetailPage
 └── PipelinesPage
     └── PipelineDetailsPanel
```

---

# `App.tsx`

Artık yalnızca application entry component seviyesindedir.

Mantıksal olarak:

`App.tsx`, React Router üzerinden `/projects`, `/runs` ve `/pipelines` sayfalarını eşler; feature veya GitHub business logic'i içermez.

Application-specific büyük logic burada tutulmaz.

---

# `ProjectsPage`

Frontend orchestration katmanıdır.

Sorumlulukları:

- GitHub user query
- repository query
- repository selection
- repository search/filter
- selected repository inspection
- refresh işlemleri
- doğru feature component'lerini göstermek

Burada UI detayından ziyade sayfa davranışı tutulmaktadır.

---

# `AppLayout`

Global uygulama layout'u.

İçerir:

```text
Sidebar
Header
GitHub account info
Refresh control
Main content area
```

Pipeline veya repository business logic'i içermez.

---

# Repository Feature

Repository işlemleri kendi feature klasöründe tutulmaktadır.

```text
features/repositories/
```

## `RepositorySearch`

Repository listesinin filtrelenmesi için search input.

## `RepositoryList`

Repository collection render sorumluluğu.

## `RepositoryCard`

Tek bir repository'nin:

- adı
- visibility
- language
- description
- default branch
- updated time

bilgilerini gösterir.

Kart tıklanınca repository selection state oluşturulur.

---

# Project Analysis Feature

```text
features/project-analysis/
```

Repository seçildikten sonra backend inspection sonucunu gösterir.

Gösterilen bilgiler:

```text
Framework
Language
Android support
iOS support
Existing CI/CD
Detection signals
Package manager / lockfile
Available package scripts
```

Örneğin:

```text
Framework       Flutter
Language        Dart
Android         Ready
iOS             Ready
Existing CI/CD  Detected

Signals:
pubspec.yaml
android/
ios/
web/
```

Project type Flutter veya Node.js ise ilgili Pipeline Builder gösterilir.

---

# Pipeline Builder

```text
features/pipelines/PipelineBuilder.tsx
```

Flutter CI/CD pipeline konfigürasyon arayüzüdür. Node.js projeleri için `NodePipelineBuilder.tsx` aynı preview/apply akışını package manager ve script seçenekleriyle sunar.

Şu an kullanıcı aşağıdaki seçenekleri değiştirebilir:

## Quality Checks

```text
☑ Flutter analyze
☑ Flutter tests
```

## Android

```text
☑ Enable Android build
☑ Build APK
☑ Build AAB
```

## iOS

```text
☑ Enable iOS build
☑ Unsigned iOS build
```

## Trigger

```text
Branch: main

☑ Push
☑ Pull Request
☑ Manual run
```

İki ana işlem bulunmaktadır:

```text
Preview
Create Pipeline
```

Node.js builder ayrıca Node sürümü, pnpm/npm/yarn/Bun, frozen lockfile ve repository'de bulunan `lint`, `typecheck`, `test`, `build` script'lerini yapılandırır.

---

# Backend Mimarisi

Backend doğrudan tek route dosyasına GitHub API çağrıları yazmak yerine katmanlara ayrılmaktadır.

Hedef dependency flow:

```text
Route
   ↓
Application Service
   ↓
Domain Logic
   ↓
Infrastructure Adapter
   ↓
External API
```

Somut olarak:

```text
Fastify Route
      ↓
Project Analysis Service
      ↓
Project Detector
      ↓
RepositoryReader
      ↓
GitHubAdapter
      ↓
Octokit
      ↓
GitHub
```

---

# `app.ts` ve `server.ts`

`buildApp()` test edilebilir Fastify uygulamasını kurar; `server.ts` yalnızca bu uygulamayı oluşturup HTTP listener'ı başlatır.

Temel görevleri:

- Fastify instance oluşturmak
- CORS register etmek
- health endpoint tanımlamak
- GitHub, runs, artifacts ve pipeline route'larını register etmek
- HTTP server'ı başlatmak

Development portu:

```text
127.0.0.1:3001
```

---

# Environment Loader

Dosya:

```text
apps/api/src/config/env.ts
```

GitHub token'ını:

```text
apps/api/.env
```

dosyasından yükler.

Environment dosyasının process working directory'ye bağlı olmaması özellikle sağlanmıştır.

İlk implementasyonda:

```ts
loadEnvFile();
```

kullanılmıştı.

Ancak monorepo root'undan uygulama çalıştırıldığında Node `.env` dosyasını yanlış dizinde aradığı için backend başlayamıyordu.

Bu nedenle `.env` path'i module location üzerinden açık şekilde resolve edilmektedir.

Bu sayede uygulama:

```text
pnpm dev
```

veya:

```text
pnpm --filter api dev
```

ile çalıştırılsa bile doğru environment dosyası yüklenir.

---

# GitHub Client

Dosya:

```text
apps/api/src/lib/github.ts
```

Tek sorumluluğu configured Octokit instance oluşturmaktır.

Mantıksal olarak:

```text
Environment
     ↓
GitHub Token
     ↓
Octokit
```

Bu dosya business logic içermez.

---

# GitHub Adapter

Dosya:

```text
apps/api/src/adapters/github/github-adapter.ts
```

Infrastructure katmanıdır.

Octokit'in gerçek GitHub REST API çağrıları burada tutulmaktadır.

Örneğin:

```text
Authenticated user
Repositories
Repository content
File existence
File SHA
File write/update
```

gibi GitHub-specific işlemler adapter tarafından gerçekleştirilir.

Böylece application logic doğrudan:

```ts
github.rest.repos.getContent(...)
```

çağırmak zorunda kalmaz.

---

# Neden Adapter?

İlk implementasyonda farklı servisler doğrudan Octokit çağırıyordu.

Örneğin:

```text
Project Detector ───────┐
Pipeline Service ───────┼──> Octokit
GitHub Routes ──────────┘
```

Bu yapı büyüdükçe GitHub infrastructure detayları business logic'e dağılacaktı.

Refactor sonrası:

```text
Project Detector
        │
Pipeline Service
        │
GitHub Service
        │
        ▼
 GitHub Adapter
        │
        ▼
     Octokit
```

haline getirilmektedir.

---

# RepositoryReader

Dosya:

```text
apps/api/src/services/repositories/repository-reader.ts
```

Project Detector'ın ihtiyaç duyduğu minimum repository abstraction'ıdır.

Mantıksal interface:

```ts
interface RepositoryReader {
  listRootEntryNames(...): Promise<Set<string>>;

  readTextFile(...): Promise<string | null>;

  pathExists(...): Promise<boolean>;
}
```

Project Detector:

```text
GitHub
```

kavramını bilmez.

Sadece:

> "Repository okuyabilen bir nesne"

ister.

GitHubAdapter bu interface'i implement eder.

Bu yaklaşım dependency inversion sağlar.

---

# Project Detector

Homemade CI/CD'nin temel domain parçalarından biridir.

Amaç:

> Bir repository'nin yapısını inceleyerek hangi teknolojiyle geliştirildiğini belirlemek.

Repository'nin GitHub tarafından bildirilen ana dili tek başına yeterli kabul edilmez.

Örneğin:

```text
language: Dart
```

bilgisi yalnızca repository'nin Dart ağırlıklı olduğunu gösterir.

Flutter olduğunu kesin olarak göstermez.

Bu nedenle detector repository yapısını inceler.

---

# Flutter Detection

Aşağıdaki signal'lar kullanılır:

```text
pubspec.yaml
```

dosyası aranır.

İçeriğinde:

```text
sdk: flutter
```

veya:

```text
flutter:
```

marker'ları aranır.

Ayrıca:

```text
android/
ios/
web/
```

klasörlerinin varlığı kontrol edilir.

Sonuç:

```text
pubspec.yaml
      +
Flutter dependency
      +
android/
      +
ios/
      ↓
Flutter Project
```

---

# Node Detection

Root'ta:

```text
package.json
```

varsa Node ecosystem projesi kabul edilir.

`package.json` dependency'leri incelenerek framework tahmini yapılır.

Desteklenen mevcut framework marker'ları:

```text
next
    → Next.js

@nestjs/core
    → NestJS

fastify
    → Fastify

express
    → Express

react + vite
    → React + Vite

react
    → React

diğer
    → Node.js
```

---

# Package Manager Detection

Repository root lockfile'ları incelenir.

```text
pnpm-lock.yaml
    → pnpm

yarn.lock
    → yarn

bun.lock / bun.lockb
    → bun

package-lock.json
    → npm
```

Lockfile yoksa Node.js pipeline'ı npm ile başlatılır ve dependency kurulumu `npm install` kullanır. Detector ayrıca `package.json` içindeki string script adlarını sıralı olarak `availableScripts` alanında döndürür. Bu bilgi builder'ın yalnızca repository'de gerçekten bulunan görevleri önermesini sağlar.

---

# Python Detection

Aşağıdaki dosyalardan en az biri aranır:

```text
pyproject.toml
requirements.txt
Pipfile
setup.py
```

Bulunursa proje Python project olarak işaretlenir.

---

# Existing CI/CD Detection

Repository'de:

```text
.github/workflows
```

path'i kontrol edilir.

Varsa:

```text
ciConfigured: true
```

olarak işaretlenir.

Bu şu anda yalnızca:

> Repository'de bir GitHub Actions workflow dizini var mı?

sorusunu cevaplamaktadır.

Project Detector'ın `ciConfigured` alanı yalnızca workflow dizininin varlığını belirtir. Pipeline yönetimi ise sabit dosya path'i ve YAML içindeki Homemade/project-type marker'ları üzerinden yönetilen workflow'u ayrıca ayırt eder.

---

# Shared Core Paketi

Frontend ve backend arasında duplicate type definition oluşmasını engellemek amacıyla:

```text
@homemade-cicd/core
```

package'ı oluşturulmuştur.

İlk implementasyonda:

```text
Frontend
├── Repository
├── ProjectAnalysis
└── FlutterPipelineConfig

Backend
├── ProjectAnalysis
├── FlutterPipelineConfig
└── schemas
```

gibi tekrarlar bulunuyordu.

Bu yapı zaman içerisinde type drift oluşturabilirdi.

Örneğin backend:

```ts
ios: {
  enabled: boolean;
  signedBuild: boolean;
}
```

eklerken frontend'in aynı alanı unutması mümkündü.

Yeni yapı:

```text
          @homemade-cicd/core
                  │
          Shared contracts
                  │
          ┌───────┴───────┐
          ▼               ▼
         Web             API
```

şeklindedir.

---

# Core İçeriği

## GitHub Models

Örneğin:

```text
GitHubUser
Repository
```

## Project Models

```text
ProjectType
PackageManager
ProjectAnalysis
RepositoryInspection
```

## Pipeline Models

```text
FlutterPipelineConfig
NodePipelineConfig
ManagedPipelineConfig
PipelinePreview
PipelineApplyResult
flutterPipelineSchema
nodePipelineSchema
managedPipelineSchema
```

---

# Zod Kullanımı

Bazı domain modelleri yalnızca TypeScript interface olarak değil, Zod schema olarak tanımlanmaktadır.

Örneğin:

```text
managedPipelineSchema
```

aynı anda iki amaç taşır.

### Compile-time

```ts
type FlutterPipelineConfig =
  z.infer<typeof flutterPipelineSchema>;
```

### Runtime

Backend'e gönderilen JSON:

```text
gerçekten geçerli ve proje türüyle eşleşen bir Flutter veya Node.js pipeline config'i mi?
```

kontrol edilir.

Bu sayede frontend ve backend aynı contract'ı kullanır.

---

# GitHub Entegrasyonu

GitHub bağlantısı şu anda local Personal Access Token ile yapılmaktadır.

Token:

```text
apps/api/.env
```

içerisinde tutulur.

Örnek:

```env
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxx
```

Gerçek token Git repository'ye commit edilmemelidir.

---

# GitHub Data Flow

```text
React
  │
  │ GET /api/github/repos
  ▼
Fastify
  │
  ▼
GitHub Service
  │
  ▼
GitHub Adapter
  │
  ▼
Octokit
  │
  ▼
GitHub REST API
```

Response ters yönde frontend'e ulaşır.

---

# Pipeline Sistemi

Pipeline sisteminde UI doğrudan YAML üretmez.

Önce domain configuration oluşturur.

Örnek:

```ts
{
  branch: "main",

  trigger: {
    push: true,
    pullRequest: true,
    manual: true
  },

  checks: {
    analyze: true,
    test: true
  },

  android: {
    enabled: true,
    apk: true,
    aab: true
  },

  ios: {
    enabled: true,
    unsignedBuild: true
  }
}
```

Flutter'a özgü alanlar `FlutterPipelineConfig`, Node.js'e özgü alanlar `NodePipelineConfig` olarak tanımlanır. API'ye gönderilen ortak discriminated union ise:

```text
ManagedPipelineConfig
├── { projectType: "flutter", config: FlutterPipelineConfig }
└── { projectType: "node", config: NodePipelineConfig }
```

Sonra:

```text
ManagedPipelineConfig
        ↓
Managed Workflow Dispatcher
        ↓
Flutter / Node.js Workflow Generator
        ↓
YAML
```

işlemi yapılır.

---

# Pipeline Preview

Preview işlemi GitHub repository'sinde değişiklik yapmaz.

Akış:

```text
PipelineBuilder
      ↓
POST /pipeline/preview
      ↓
Zod validation
      ↓
Workflow Generator
      ↓
Generated YAML
      ↓
Frontend Preview
```

Bu sayede kullanıcı workflow'u GitHub'a yazmadan önce oluşturulan YAML'ı görebilir.

---

# Create Pipeline

Create Pipeline:

```text
PipelineBuilder
      ↓
PUT /pipeline
      ↓
Zod validation
      ↓
Workflow Generator
      ↓
Pipeline Service
      ↓
GitHub Adapter
      ↓
GitHub Contents API
      ↓
.github/workflows/homemade-ci.yml
```

---

# Flutter Workflow Generator

Dosya:

```text
apps/api/src/services/pipelines/workflow-generator.ts
```

Görevi:

```text
FlutterPipelineConfig
```

nesnesini GitHub Actions workflow'una dönüştürmektir.

Flutter ve Node.js generator'ları ürettikleri YAML'ın başına yönetim, proje türü ve trigger branch metadata marker'ları ekler. `generateManagedWorkflow` discriminated union içindeki `projectType` değerine göre doğru generator'ı çağırır; `parseManagedWorkflow` aynı marker üzerinden doğru parser'a yönlendirir. Branch metadata'sı manual-only workflow'ların da edit ekranında aynı branch ile açılmasını sağlar. Marker içermeyen eski Flutter workflow'ları, Flutter action imzası algılanarak geriye uyumlu biçimde parse edilir.

---

# Node.js Workflow Generator

Node.js pipeline'ları `ubuntu-latest` üzerinde checkout ve `actions/setup-node@v4` adımlarını çalıştırır. pnpm için `pnpm/action-setup@v4`, Yarn için sabitlenmiş bir Corepack sürümü, Bun için `oven-sh/setup-bun@v2` hazırlanır. Dependency kurulumu package manager ve `frozenLockfile` seçimine göre yapılır:

```text
pnpm  → pnpm install [--frozen-lockfile]
npm   → npm ci | npm install
yarn  → yarn install [--frozen-lockfile]
bun   → bun install [--frozen-lockfile]
```

Seçilen ve repository'de mevcut olan görevler sırasıyla `<manager> run lint`, `typecheck`, `test` ve `build` komutlarına dönüşür. Push, pull request ve manual trigger'lar Flutter ile aynı ortak contract'ı kullanır; hiçbir trigger seçilmezse manual dispatch eklenir.

---

# Quality Job

Analyze veya test seçilmişse:

```text
quality
```

job'ı oluşturulur.

Runner:

```text
ubuntu-latest
```

Temel steps:

```text
Checkout repository
      ↓
Set up Flutter
      ↓
flutter pub get
      ↓
flutter analyze
      ↓
flutter test
```

Analyze/test seçimlerine göre ilgili step'ler eklenir veya çıkarılır.

---

# Android Pipeline

Android build:

```text
ubuntu-latest
```

runner üzerinde çalışır.

Pipeline:

```text
Checkout
   ↓
Java Setup
   ↓
Flutter Setup
   ↓
flutter pub get
   ↓
APK
   ↓
AAB
   ↓
Artifacts
```

Java:

```text
Temurin 17
```

kullanılmaktadır.

---

# APK Build

Seçiliyse:

```bash
flutter build apk --release
```

çalıştırılır.

Artifact:

```text
build/app/outputs/flutter-apk/app-release.apk
```

GitHub Actions artifact olarak upload edilir.

Artifact adı:

```text
android-apk
```

---

# AAB Build

Seçiliyse:

```bash
flutter build appbundle --release
```

çalıştırılır.

Artifact path:

```text
build/app/outputs/bundle/release/app-release.aab
```

Artifact adı:

```text
android-aab
```

---

# Android Job Dependency

Quality checks aktifse:

```text
quality
   ↓
android
```

şeklinde dependency oluşturulur.

Yani analyze/test başarısız olursa Android build başlamaz.

---

# iOS Pipeline

iOS build:

```text
macos-latest
```

GitHub Actions runner üzerinde çalışır.

Bu önemli çünkü Flutter iOS build için macOS/Xcode environment gerekir.

Kullanıcının local geliştirme bilgisayarı Windows olsa bile iOS compilation GitHub'ın macOS runner'ında yapılabilir.

Mevcut ilk aşamada:

```text
unsigned iOS build
```

desteklenmektedir.

---

# iOS Build Flow

```text
Checkout
    ↓
Flutter Setup
    ↓
flutter pub get
    ↓
flutter build ios --release --no-codesign
    ↓
Runner.app
    ↓
GitHub Artifact
```

Komut:

```bash
flutter build ios --release --no-codesign
```

Artifact path:

```text
build/ios/iphoneos/Runner.app
```

Artifact adı:

```text
ios-unsigned
```

---

# Neden İlk Aşamada Unsigned iOS?

Signed IPA üretimi ek olarak:

```text
Apple certificate
Provisioning profile
Signing identity
Secrets
Bundle configuration
```

gerektirir.

İlk milestone'un amacı öncelikle:

> Proje iOS için compile oluyor mu?

sorusunu cevaplamaktır.

Signed IPA ve App Store/TestFlight entegrasyonu sonraki milestone'lara bırakılmıştır.

---

# Workflow Trigger'ları

Şu anda desteklenen trigger türleri:

## Push

```text
push → selected branch
```

Örneğin:

```text
main
```

branch'ine push yapılınca workflow çalışır.

## Pull Request

Belirlenen branch'i hedefleyen pull request workflow'u tetikler.

## Manual

GitHub:

```text
workflow_dispatch
```

trigger'ı kullanılır.

Bu ileride Homemade CI/CD panelinden:

```text
Run Now
```

özelliğinin temelini oluşturacaktır.

---

# Workflow Permissions

Generated workflow mümkün olduğunca minimum permission ile oluşturulmaktadır.

Mevcut workflow:

```yaml
permissions:
  contents: read
```

yaklaşımını kullanmaktadır.

---

# Workflow'un GitHub'a Yazılması

Dosya yolu sabittir:

```text
.github/workflows/homemade-ci.yml
```

Pipeline Service önce mevcut dosyanın SHA değerini kontrol eder.

## Dosya yoksa

Yeni workflow oluşturulur.

Commit message:

```text
ci: add Homemade CI/CD pipeline
```

## Dosya varsa

Dosya güncellenir.

Commit message:

```text
ci: update Homemade CI/CD pipeline
```

GitHub Contents API güncelleme yaparken mevcut file SHA değerini gerektirdiği için adapter bu değeri önceden alır.

---

# API Endpoint'leri

Backend development adresi:

```text
http://127.0.0.1:3001
```

---

## Health

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "homemade-cicd-api"
}
```

---

## GitHub User

```http
GET /api/github/me
```

Authenticated GitHub kullanıcısını döndürür.

Örnek response:

```json
{
  "login": "username",
  "name": "Name",
  "avatarUrl": "...",
  "profileUrl": "..."
}
```

---

## Repository Listesi

```http
GET /api/github/repos
```

Kullanıcının erişebildiği repository'leri döndürür.

Örnek:

```json
[
  {
    "id": 123456,
    "name": "example",
    "fullName": "username/example",
    "private": true,
    "description": null,
    "language": "Dart",
    "defaultBranch": "main",
    "updatedAt": "...",
    "url": "...",
    "owner": {
      "login": "username",
      "avatarUrl": "..."
    }
  }
]
```

---

# Repository Inspection

```http
GET /api/github/repos/:owner/:repo/inspect
```

Repository'nin proje yapısını analiz eder.

Örnek:

```json
{
  "repository": {
    "owner": "username",
    "name": "flutter-example"
  },
  "analysis": {
    "projectType": "flutter",
    "framework": "Flutter",
    "language": "Dart",
    "packageManager": null,
    "lockfilePresent": false,
    "availableScripts": [],
    "platforms": {
      "android": true,
      "ios": true,
      "web": true
    },
    "ciConfigured": true,
    "signals": [
      "pubspec.yaml",
      "android/",
      "ios/",
      "web/"
    ]
  }
}
```

---

# Pipeline Preview

```http
POST /api/github/repos/:owner/:repo/pipeline/preview
```

Request body:

```json
{
  "projectType": "flutter",
  "config": {
    "branch": "main",
    "trigger": {
      "push": true,
      "pullRequest": true,
      "manual": true
    },
    "checks": {
      "analyze": true,
      "test": true
    },
    "android": {
      "enabled": true,
      "apk": true,
      "aab": true
    },
    "ios": {
      "enabled": true,
      "unsignedBuild": true
    }
  }
}
```

Node.js için aynı endpoint'e aşağıdaki discriminated payload gönderilir:

```json
{
  "projectType": "node",
  "config": {
    "branch": "main",
    "nodeVersion": "24",
    "packageManager": "pnpm",
    "frozenLockfile": true,
    "trigger": {
      "push": true,
      "pullRequest": true,
      "manual": true
    },
    "tasks": {
      "lint": true,
      "typecheck": true,
      "test": true,
      "build": true
    }
  }
}
```

Repository üzerinde değişiklik yapmadan YAML üretir.

---

# Pipeline Apply

```http
PUT /api/github/repos/:owner/:repo/pipeline
```

Aynı `ManagedPipelineConfig` body kullanılır.

Workflow'u:

```text
.github/workflows/homemade-ci.yml
```

dosyasına yazar.

---

# Pipeline ve Run Yönetimi

```http
GET    /api/github/repos/:owner/:repo/pipelines
GET    /api/github/repos/:owner/:repo/pipelines/:workflowId
POST   /api/github/repos/:owner/:repo/pipelines/:workflowId/enable
POST   /api/github/repos/:owner/:repo/pipelines/:workflowId/disable
DELETE /api/github/repos/:owner/:repo/pipelines/:workflowId

GET  /api/github/repos/:owner/:repo/runs
GET  /api/github/repos/:owner/:repo/runs/:runId
GET  /api/github/repos/:owner/:repo/runs/:runId/jobs
POST /api/github/repos/:owner/:repo/runs/dispatch
POST /api/github/repos/:owner/:repo/runs/:runId/rerun
POST /api/github/repos/:owner/:repo/runs/:runId/rerun-failed
POST /api/github/repos/:owner/:repo/runs/:runId/cancel

GET /api/github/repos/:owner/:repo/runs/:runId/artifacts
GET /api/github/repos/:owner/:repo/artifacts/:artifactId/download
```

Pipeline detay endpoint'i Homemade marker'lı Flutter ve Node.js workflow'larını kendi config türlerine parse eder. Enable/disable GitHub Actions workflow state'ini değiştirir; delete yalnızca Homemade tarafından yönetilen sabit workflow path'i için kullanılabilir.

---

# Development Ortamı

Gereksinimler:

```text
Node.js 24
pnpm
Git
VSCode veya başka bir editor
GitHub account
GitHub Personal Access Token
```

---

# Kurulum

Repository clone:

```powershell
git clone <repository>
cd homemade-cicd
```

Dependency install:

```powershell
pnpm install
```

Environment dosyası oluştur:

```text
apps/api/.env
```

İçerik:

```env
GITHUB_TOKEN=YOUR_TOKEN
```

Ardından:

```powershell
pnpm dev
```

---

# Development Adresleri

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://127.0.0.1:3001
```

---

# Vite Proxy

Frontend doğrudan:

```text
http://127.0.0.1:3001
```

adresini hard-code etmez.

Frontend request:

```text
/api/github/repos
```

şeklindedir.

Vite development server bunu:

```text
localhost:5173/api/github/repos
             ↓
        Vite proxy
             ↓
127.0.0.1:3001/api/github/repos
```

şeklinde backend'e yönlendirir.

Bu sayede frontend API host detayını bilmez.

---

# pnpm Workspace Yapısı

Root:

```text
pnpm-workspace.yaml
```

workspace package location'larını tanımlar.

Temel yapı:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Bu nedenle:

```text
apps/web
apps/api
packages/core
```

tek workspace'in üyeleridir.

---

# Workspace Dependency

`web` ve `api`, shared core package'a:

```text
workspace:*
```

üzerinden bağlıdır.

Örneğin:

```json
"@homemade-cicd/core": "workspace:*"
```

Anlamı:

> Package'ı npm registry'den indirme; bu workspace içerisindeki local package'ı kullan.

---

# Dependency Lock

Monorepo genelinde tek:

```text
pnpm-lock.yaml
```

kullanılır.

Bu dependency resolution'ın reproducible olmasını sağlar.

---

# Kullanılan Önemli Komutlar

## Tüm dependency'leri kur

```powershell
pnpm install
```

---

## Tüm development ortamını başlat

```powershell
pnpm dev
```

Root script iki uygulamayı paralel başlatır:

```text
Vite
  +
Fastify
```

---

## Yalnız API

```powershell
pnpm --filter api dev
```

---

## Yalnız frontend

```powershell
pnpm --filter web dev
```

---

## API dependency ekle

```powershell
pnpm --filter api add PACKAGE
```

Örneğin:

```powershell
pnpm --filter api add octokit
```

---

## Frontend dependency ekle

```powershell
pnpm --filter web add PACKAGE
```

---

# Development Dependency

```powershell
pnpm --filter api add -D PACKAGE
```

`-D`:

```text
--save-dev
```

anlamına gelir.

---

# Exact Version

Toolchain dependency'sini exact version ile sabitlemek:

```powershell
pnpm --filter api add -D --save-exact typescript@6.0.3
```

Böylece:

```json
"typescript": "6.0.3"
```

yazılır.

`^6.0.3` kullanılmaz.

---

# Workspace Package Ekleme

API:

```powershell
pnpm --filter api add "@homemade-cicd/core@workspace:*"
```

Web:

```powershell
pnpm --filter web add "@homemade-cicd/core@workspace:*"
```

---

# Dependency Kaynağını Gör

```powershell
pnpm why @homemade-cicd/core
```

Bir dependency'nin hangi package tarafından kullanıldığını gösterir.

---

# Package Binary Çalıştırma

Örneğin:

```powershell
pnpm --filter api exec tsx src/server.ts
```

API package context'inde `tsx` binary'sini doğrudan çalıştırır.

Debug sırasında watcher katmanını kaldırmak için kullanılmıştır.

---

# Typecheck

Tüm workspace:

```powershell
pnpm typecheck
```

veya ayrı ayrı:

```powershell
pnpm --filter @homemade-cicd/core typecheck
pnpm --filter api typecheck
pnpm --filter web typecheck
```

---

# API Development Watcher

İlk olarak:

```text
tsx watch src/server.ts
```

kullanılmıştır.

Windows development ortamında watcher process davranışı nedeniyle API'nin başlamadığı bir durum görülmüştür.

Doğrudan:

```powershell
pnpm --filter api exec tsx src/server.ts
```

çalıştırıldığında backend sorunsuz başlamıştır.

Bunun üzerine watcher Node'un native watch sistemiyle değiştirilmiştir:

```text
node --watch --import tsx src/server.ts
```

Böylece:

```text
File watching → Node
TypeScript execution → tsx
```

olarak ayrılmıştır.

---

# TypeScript Yapısı

Development sırasında API'nin JavaScript build output üretmesine ihtiyaç yoktur.

Bu nedenle API `tsconfig.json`:

```json
"noEmit": true
```

kullanmaktadır.

TypeScript burada yalnızca typecheck yapar.

Runtime:

```text
tsx
```

üzerinden TypeScript source doğrudan çalıştırılır.

İleride production build gerekirse ayrı:

```text
tsconfig.build.json
```

oluşturulması planlanmaktadır.

---

# Environment Variables

Gerçek secrets:

```text
apps/api/.env
```

içerisindedir.

Örnek template:

```text
apps/api/.env.example
```

```env
GITHUB_TOKEN=github_token_buraya
```

Gerçek `.env` Git'e gönderilmez.

---

# `.gitignore`

En az aşağıdaki private/generated içerikler ignore edilmelidir:

```gitignore
node_modules/
dist/

.env
.env.*
!.env.example

*.db
*.db-shm
*.db-wal

.DS_Store
Thumbs.db
```

---

# Güvenlik

## Token Frontend'e Gönderilmez

En önemli prensiplerden biri:

```text
Browser
   ✗
GITHUB_TOKEN
```

Token yalnızca backend process tarafından okunur.

Akış:

```text
Browser
   ↓
Fastify
   ↓
Token
   ↓
Octokit
   ↓
GitHub
```

Frontend hiçbir noktada Personal Access Token'ı görmez.

---

# Fine-Grained Token

Token'ın yalnızca Homemade CI/CD'nin ihtiyaç duyduğu repository ve izinlerle sınırlandırılması önerilir.

Workflow yazılması gerektiği için repository content/workflow erişimi gerekir.

Token:

- source code içine yazılmamalı,
- README'ye eklenmemeli,
- `.env.example` içerisine gerçek değer olarak yazılmamalı,
- Git'e commit edilmemelidir.

---

# Git Stratejisi

İlk milestone doğrudan çalışan vertical slice oluşturularak tamamlanmıştır.

Milestone:

```text
GitHub
↓
Repository List
↓
Project Detector
↓
Flutter Pipeline Builder
↓
Preview
↓
Create Workflow
```

çalışır hale geldikten sonra checkpoint commit alınmıştır.

---

# Milestone Commit

Örnek:

```bash
git add -A
git commit -m "feat: complete Flutter CI/CD pipeline milestone"
```

---

# Version Tag

İlk çalışan milestone:

```bash
git tag v0.1.0
```

ile işaretlenebilir.

---

# Refactor Branch

Çalışan `main` branch'i bozmamak için refactor ayrı branch üzerinde yapılmaktadır:

```bash
git switch -c refactor/milestone-1-architecture
```

Mantık:

```text
main
  │
  ● v0.1.0
   \
    \
     ● refactor/milestone-1-architecture
```

---

# Commit Convention

Projede anlamlı commit prefix'leri kullanılmaktadır.

```text
feat:
```

Yeni özellik.

```text
fix:
```

Bug fix.

```text
refactor:
```

Davranış değiştirmeden mimari/kod temizliği.

```text
chore:
```

Tooling veya bakım.

```text
test:
```

Test değişiklikleri.

```text
docs:
```

Dokümantasyon.

Örnek:

```text
feat: complete Flutter CI/CD pipeline milestone
refactor: extract shared domain models
refactor: split frontend into feature components
refactor: isolate GitHub adapter from application logic
```

---

# Refactor Süreci

İlk çalışan milestone sonrasında bilinçli olarak feature geliştirmeye ara verilmiş ve teknik borç büyümeden refactor yapılmıştır.

Amaç:

> Yeni özellik eklemek değil, mevcut davranışı koruyarak kodun genişletilebilirliğini artırmak.

---

# Refactor 1 — Shared Domain

Problem:

Frontend ve backend aynı kavramları ayrı ayrı tanımlıyordu.

Çözüm:

```text
packages/core
```

oluşturuldu.

Sonuç:

```text
                  CORE
                 /    \
                /      \
              WEB      API
```

Tek contract.

---

# Refactor 2 — Frontend Features

Problem:

`App.tsx`:

```text
queries
layout
repository list
repository cards
search
analysis
pipeline
```

gibi çok fazla sorumluluk taşıyordu.

Çözüm:

```text
features/
layouts/
pages/
```

ayrımı oluşturuldu.

Sonuç:

```text
App.tsx
   ↓
ProjectsPage
   ↓
Feature Components
```

---

# Refactor 3 — Infrastructure Isolation

Problem:

Project Detector ve Pipeline Service doğrudan Octokit kullanıyordu.

Bu:

```text
domain logic
      ↓
GitHub SDK
```

coupling'i oluşturuyordu.

Çözüm:

```text
RepositoryReader
GitHubAdapter
Application Services
```

katmanları oluşturuldu.

Yeni dependency direction:

```text
Project Detector
      ↓
RepositoryReader
      ↑
GitHubAdapter
      ↓
Octokit
```

Böylece Project Detector artık GitHub'ın varlığını bile bilmek zorunda değildir.

---

# Bunun Test Açısından Önemi

Eski durumda Project Detector'ı test etmek:

```text
GitHub account
GitHub token
Internet
Repository
Octokit
```

gerektiriyordu.

Yeni durumda:

```ts
const fakeReader = {
  async listRootEntryNames() {
    return new Set([
      "pubspec.yaml",
      "android",
      "ios"
    ]);
  },

  async readTextFile() {
    return `
      dependencies:
        flutter:
          sdk: flutter
    `;
  },

  async pathExists() {
    return false;
  }
};
```

gibi fake implementation ile:

```text
GitHub yok
Internet yok
Token yok
```

iken Project Detector test edilebilir.

Bu yaklaşım bir sonraki test milestone'unun temelidir.

---

# Mevcut Veri Akışı

## Repository Listeleme

```text
ProjectsPage
      ↓
TanStack Query
      ↓
api.github.repositories()
      ↓
GET /api/github/repos
      ↓
GitHub Route
      ↓
GitHub Service
      ↓
GitHub Adapter
      ↓
Octokit
      ↓
GitHub
```

---

# Repository Inspection

```text
RepositoryCard
      ↓
selectedRepository
      ↓
ProjectsPage
      ↓
TanStack Query
      ↓
GET /inspect
      ↓
Project Analysis Service
      ↓
Project Detector
      ↓
RepositoryReader
      ↓
GitHub Adapter
      ↓
GitHub Repository
```

---

# Pipeline Preview

```text
PipelineBuilder
      ↓
FlutterPipelineConfig
      ↓
POST /pipeline/preview
      ↓
Zod
      ↓
Workflow Generator
      ↓
YAML
      ↓
Frontend
```

Bu akış repository'yi değiştirmez.

---

# Pipeline Creation

```text
PipelineBuilder
      ↓
FlutterPipelineConfig
      ↓
PUT /pipeline
      ↓
Zod Validation
      ↓
Workflow Generator
      ↓
Pipeline Service
      ↓
GitHub Adapter
      ↓
GitHub Contents API
      ↓
homemade-ci.yml
```

---

# CI/CD'nin Gerçek Execution Katmanı

Homemade CI/CD pipeline'ı kendi backend process'inde çalıştırmaz.

Yani:

```text
Fastify
  ✗ flutter build
```

yapılmaz.

Bunun yerine:

```text
Homemade CI/CD
       ↓
Workflow oluşturur
       ↓
GitHub
       ↓
GitHub Actions
       ↓
Runner
       ↓
flutter analyze/test/build
```

Bu mimari önemli bir tasarım kararıdır.

---

# Test Stratejisi

Vitest ile project detector, Flutter/Node.js workflow generator ve parser'ları, managed dispatcher ve route validation için otomatik regresyon testleri çalıştırılır. Kök `pnpm check` komutu ayrıca tüm workspace'lerde typecheck, frontend lint ve production build gerçekleştirir.

Kontrol edilen temel akış:

```text
GitHub user             ✓
Repository listing      ✓
Search                  ✓
Repository selection    ✓
Flutter detection       ✓
Android detection       ✓
iOS detection           ✓
Pipeline preview        ✓
Pipeline creation       ✓
Pipeline update         ✓
Node detection          ✓
Node workflow           ✓
Managed round-trip      ✓
Route validation        ✓
```

---

# Unit Test Kapsamı

## Flutter Detection

```text
pubspec.yaml
android/
ios/
```

→ Flutter.

## Node Detection

```text
package.json
vite
react
```

→ React + Vite.

## Python Detection

```text
pyproject.toml
```

→ Python.

## Unknown

Bilinen marker yoksa:

```text
unknown
```

---

# Workflow Generator Testleri

Örneğin:

```text
analyze = true
test = true
android.apk = true
ios = false
```

verildiğinde oluşturulan workflow'da:

```text
flutter analyze
flutter test
flutter build apk --release
```

bulunmalı.

Ama:

```text
macos-latest
```

bulunmamalıdır.

Node.js tarafında tüm package manager kurulumları, frozen/non-frozen davranışı, görev ve trigger kombinasyonları; Flutter ve Node.js tarafında generate/parse round-trip davranışı test edilir. Eski marker'sız Flutter YAML desteği de geriye uyumluluk testiyle korunur.

---

# Bilinen Sınırlamalar

Şu anki sürüm deliberately minimaldir.

Henüz desteklenmeyen başlıca özellikler:

### CI/CD

- Python pipeline generation
- signed iOS IPA
- TestFlight deployment
- App Store deployment
- Google Play deployment
- environment management
- staging/production
- deployment approvals
- matrix builds
- Docker build
- dependency scanning
- security scanning

### GitHub Actions Monitoring

- tam workflow log içeriğini panel içinde görüntüleme
- pagination ve geçmiş run'ların tamamını yükleme

### Platform

- multi-user
- GitHub OAuth
- database persistence
- organization support
- workspace system
- roles
- billing

---

# Roadmap

Güncel milestone durumu:

| Milestone | Kapsam | Durum |
| --- | --- | --- |
| M0 | Bootstrap | DONE |
| M1 | Flutter Pipeline | DONE |
| M1.5 | Architecture Refactor | DONE |
| M2 | Runs Dashboard | DONE |
| M3 | Artifacts | DONE |
| M4 | Pipeline Management | DONE |
| M5 | Node.js Pipelines | DONE |
| M6 | Python | NEXT |

## Milestone 0 — Bootstrap

```text
pnpm workspace
React
Fastify
TypeScript
GitHub connection
```

Durum:

```text
DONE
```

---

# Milestone 1 — Flutter Pipeline

```text
Repository list
Project detector
Flutter detection
Pipeline builder
Preview
Create workflow
Android build
iOS unsigned build
```

Durum:

```text
DONE
```

---

# Milestone 1.5 — Architecture Refactor

```text
Shared core
Frontend feature split
GitHub adapter
Repository abstraction
Thin routes
```

Durum:

```text
DONE
```

---

# Automated Test Foundation

Plan:

```text
Vitest
      ↓
Project Detector tests
      ↓
Workflow Generator tests
      ↓
Regression safety net
```

Durum: `DONE`

---

# Milestone 2 — Runs Dashboard

Hedef:

```text
GitHub Actions
      ↓
Workflow Runs API
      ↓
Homemade CI/CD
```

Durum: `DONE`

UI:

```text
Build #42

✓ Checkout
✓ Dependencies
✓ Analyze
✓ Tests
● Android Build
○ iOS Build
```

---

# Milestone 3 — Artifacts

Panel üzerinden:

```text
APK
AAB
iOS artifact
```

görüntüleme.

Durum: `DONE`

Hedef UI:

```text
Artifacts

Android APK
12.4 MB
[ Download ]

Android AAB
10.7 MB
[ Download ]

iOS Build
...
```

---

# Milestone 4 — Pipeline Management

Hedef:

```text
Run Now
Re-run
Cancel
Enable / Disable
Edit / Delete
Workflow reverse parsing
```

Workflow dispatch ve run operations GitHub API üzerinden yönetilir. Repository workflow'ları ayrıca listelenebilir, incelenebilir, etkinleştirilebilir, devre dışı bırakılabilir ve Homemade yönetimindeki workflow silinebilir.

Durum: `DONE`

---

# Milestone 5 — Node.js Pipelines

Project Detector tarafından algılanan:

```text
Node
React
React + Vite
Next.js
Fastify
Express
NestJS
```

projeleri için pipeline preset'leri.

Örnek:

```text
Node Setup
npm/pnpm install
lint
typecheck
test
build
```

pnpm, npm, yarn ve Bun; frozen lockfile kurulumu, seçilebilir Node sürümü, repository script discovery ve managed YAML round-trip desteği tamamlandı.

Durum: `DONE`

---

# Milestone 6 — Python

Destek planı:

```text
Python setup
pip/uv/poetry
ruff
pytest
mypy
build
```

Durum: `NEXT`

---

# Gelecek — Signed iOS

Hedef:

```text
Certificate
Provisioning Profile
GitHub Secrets
macOS runner
Signed IPA
```

UI üzerinden signing configuration yönetimi planlanmaktadır.

---

# Gelecek — Releases

Homemade CI/CD panelinden:

```text
Version
Release Notes
Artifacts

[ Release ]
```

ile GitHub Release oluşturma.

---

# Gelecek — Store Deployment

Uzun vadede:

```text
Android
   ↓
Google Play

iOS
   ↓
TestFlight
   ↓
App Store
```

deployment desteği.

---

# Uzun Vadeli Mimari

Sistem ileride aşağıdaki yapıya genişleyebilir:

```text
                       Web UI
                          │
                          ▼
                         API
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
     Repository        Pipeline        Run
      Services         Services      Services
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    SCM Abstraction
                     /           \
                    /             \
                   ▼               ▼
                GitHub           GitLab
                  │
                  ▼
               Actions
                  │
                  ▼
               Runners
```

---

# Potansiyel SCM Genişletmesi

RepositoryReader abstraction sayesinde teorik olarak:

```text
Project Detector
      ↓
RepositoryReader
      ↑
 ┌────┴────┐
 │         │
 ▼         ▼
GitHub    Local
```

ve ileride:

```text
GitLab
Bitbucket
```

adapter'ları eklenebilir.

Project Detector'ın yeniden yazılması gerekmez.

---

# Potansiyel Local Repository Modu

İleride şu model desteklenebilir:

```text
Local folder
    ↓
LocalRepositoryReader
    ↓
Project Detector
```

Bu durumda proje henüz GitHub'a push edilmemiş olsa bile Homemade CI/CD:

```text
Flutter detected
Node detected
Python detected
```

analizini yapabilir.

---

# Potansiyel Pipeline Preset Sistemi

Uzun vadede:

```text
Flutter Standard
Flutter Release
Node Standard
Python Standard
```

preset'leri oluşturulabilir.

Örneğin:

```text
Flutter Standard

✓ Analyze
✓ Test
✓ APK
✓ AAB
✓ iOS
```

Kullanıcı tek tıkla preset uygulayabilir.

---

# Potansiyel Smart Build

Her commit'te pahalı build'leri çalıştırmak yerine:

```text
Analyze/Test → her push
Android      → main
iOS          → release veya manual
```

gibi stratejiler oluşturulabilir.

Örneğin yalnız:

```text
README.md
```

değiştiğinde mobil build'lerin çalıştırılmaması ileride değerlendirilebilir.

---

# Potansiyel AI Pipeline Builder

Deterministic pipeline engine tamamlandıktan sonra opsiyonel bir AI layer düşünülebilir.

Örneğin:

```text
"Bu repository için uygun CI/CD oluştur."
```

Komutuyla:

```text
Repository analysis
       ↓
Project Detector
       ↓
AI recommendation
       ↓
PipelineConfig
       ↓
Deterministic Workflow Generator
```

çalışabilir.

Burada AI doğrudan YAML üretmek yerine mevcut güvenli domain config modelini doldurmalıdır.

Bu sayede:

```text
AI → suggestion
Engine → deterministic execution
```

ayrımı korunur.

---

# Projenin Temel Felsefesi

Homemade CI/CD'nin amacı yeni bir GitHub Actions alternatifi oluşturmak değildir.

GitHub Actions zaten:

- execution,
- runners,
- workflow scheduling,
- artifacts,
- releases,
- repository integration

gibi güçlü altyapılara sahiptir.

Asıl hedef:

> Bu altyapının developer-facing karmaşıklığını azaltan, görsel ve kişisel bir orchestration layer geliştirmektir.

Kullanıcı:

```text
"I want analyze + tests + Android + iOS."
```

der.

Sistem:

```text
jobs
runs-on
steps
uses
needs
artifacts
workflow_dispatch
```

detaylarını kendisi yönetir.

---

# Current Status

Proje Flutter ve Node.js için gerçek end-to-end CI/CD akışlarını tamamlamıştır. Milestone 0–5 kapsamı çalışır durumdadır; sıradaki hedef Python pipeline desteğidir.

Çalışan akış:

```text
GitHub repository
        ↓
Homemade CI/CD Dashboard
        ↓
Repository Inspection
        ↓
Flutter / Node.js Detection
        ↓
Project-specific Pipeline Builder
        ↓
Preview
        ↓
Workflow Generator
        ↓
GitHub Contents API
        ↓
.github/workflows/homemade-ci.yml
        ↓
GitHub Actions
```

Flutter ve Node.js config'leri ortak managed dispatcher üzerinden doğrulanır, uygun YAML generator'a gönderilir ve repository içerisinde:

```text
.github/workflows/homemade-ci.yml
```

dosyası otomatik olarak oluşturulur veya güncellenir.

Panel ayrıca GitHub Actions run ve job durumlarını izler; workflow dispatch, re-run, failed-job re-run ve cancel komutlarını çalıştırır; artifact'leri listeler ve indirir. Pipelines ekranı repository workflow'larını listeler, Homemade tarafından yönetilen YAML'ı tekrar config'e parse eder ve enable/disable/delete işlemlerini sunar.

Bu noktadan itibaren Homemade CI/CD yalnızca bir UI prototipi değildir.

**Gerçek bir repository analiz eden, CI/CD konfigürasyonu üreten ve bu konfigürasyonu GitHub'a uygulayan çalışan bir sistemdir.**

---

# License

Şimdilik proje kişisel geliştirme ve öğrenme amacıyla yürütülmektedir.

Lisanslama modeli proje public kullanıma açılmadan önce belirlenecektir.
