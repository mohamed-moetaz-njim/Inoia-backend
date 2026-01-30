# Inoia Backend

![Status](https://img.shields.io/badge/Status-Under_Development-orange?style=for-the-badge)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

> **Note:** This project is currently under active development. Features and APIs are subject to change.

## 📖 Overview

**Inoia** is a comprehensive mental health support platform designed specifically for students. It provides a safe, anonymous space for peer support, professional guidance, and AI-assisted mental health monitoring.

This repository hosts the **RESTful Backend API** built with **NestJS**, serving as the core engine for the Inoia ecosystem. It handles authentication, community interactions, AI chat processing, and secure data management with a strong focus on user privacy and safety.

## ✨ Key Features

### 🛡️ Core Platform
- **Secure Authentication**: Robust JWT-based auth with access/refresh tokens and Argon2 hashing.
- **Role-Based Access Control (RBAC)**: Granular permissions for Users, Moderators, and Admins.
- **Community Forum**: Anonymous posting, commenting, voting, and rich content support.
- **Therapist Verification**: dedicated workflow for verifying and listing professional therapists.

### 🤖 AI & Safety
- **AI Chat Listener**: Integrated with **Google Gemini** to provide 24/7 empathetic support.
- **Risk Detection**: Real-time analysis of conversations to detect high-risk keywords and trigger safety protocols.
- **Automated Moderation**: Content filtering and reporting systems to maintain a safe community environment.

### ⚙️ Technical Highlights
- **Scalable Architecture**: Modular NestJS structure following best practices.
- **Type Safety**: End-to-end type safety with TypeScript and Prisma DTOs.
- **Database**: High-performance PostgreSQL database with Prisma ORM.
- **Email System**: Transactional emails powered by Resend (Verification, Password Reset).

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | [NestJS](https://nestjs.com/) (Node.js) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) |
| **ORM** | [Prisma](https://www.prisma.io/) |
| **AI Engine** | [Google Gemini](https://deepmind.google/technologies/gemini/) |
| **Authentication** | Passport.js, JWT, Argon2 |
| **Validation** | class-validator, class-transformer |
| **Documentation** | Swagger / OpenAPI |
| **Testing** | Jest, Supertest |
| **Deployment** | Render / Docker |

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (or Docker)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mohamed-moetaz-njim/Inoia-backend
   cd Inoia-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
   Update the following variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/inoia_db"
   JWT_SECRET="your_super_secret_key"
   GEMINI_API_KEY="your_google_gemini_key"
   RESEND_API_KEY="your_resend_api_key"
   ```

4. **Setup Database**
   ```bash
   # Generate Prisma Client
   npx prisma generate

   # Run Migrations
   npx prisma migrate dev
   ```

5. **Run the Application**
   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run start:prod
   ```

## 🧪 Testing

We maintain high code quality with comprehensive unit and end-to-end tests.

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run test coverage
npm run test:cov
```

## 📂 Project Structure

```
src/
├── admin/          # Admin dashboard & user management
├── ai-chat/        # AI listener logic & Gemini integration
├── auth/           # Authentication & Authorization strategies
├── common/         # Global guards, filters, decorators, & utils
├── email/          # Email service (Resend)
├── forum/          # Community posts & interactions
├── notification/   # User notification system
├── prisma/         # Database connection module
├── report/         # Content moderation & reporting
├── users/          # User profile management
└── main.ts         # Application entry point
```

## 📄 API Documentation

The API is documented using Swagger. Once the application is running, visit:

`http://localhost:3000/api`

Or view the live documentation (if deployed):
[Live API Docs](https://inoia-backend-bmcn.onrender.com/api)


## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
