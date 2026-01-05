# Inoia — Mental Health Support Platform (Backend)

A secure, scalable, and production-ready backend for a student-focused mental health community platform.

## Features
- **Full Authentication**: JWT with refresh tokens, Argon2 hashing, email verification, password reset
- **Role-Based Access Control**: STUDENT, THERAPIST, and ADMIN roles
- **Forum System**: Posts, comments, pagination, ownership enforcement
- **Content Reporting & Moderation**: User reports with admin review, resolution, and audit trail
- **Therapist Verification**: Dedicated workflow for credential review
- **Safety & Security**: Soft deletes, rate limiting, input validation, Helmet headers
- **Comprehensive Testing**: End-to-end and high-coverage unit tests

## Tech Stack
- NestJS (TypeScript)
- Prisma ORM
- PostgreSQL
- Docker
- Security: JWT, Argon2, Helmet, ThrottlerGuard

## Setup

1. **Environment**
   ```bash
   cp .env.example .env
   # Fill in your values (especially DATABASE_URL and JWT secrets)
   ```

2. **Start Database**
   ```bash
   docker-compose up -d
   ```

3. **Apply Migrations**
   ```bash
   npx prisma migrate dev
   ```

4. **Run Application**
   ```bash
   npm install
   npm run start:dev
   ```

## Testing

```bash
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:cov      # Coverage report
```

## Status
**Active Development** — Core features are production-ready.
Built with care for student mental health.
