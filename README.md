# Inoia Backend

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![NestJS](https://img.shields.io/badge/framework-NestJS-E0234E.svg)

Secure backend API for Inoia, a mental health support platform for students (community forum, AI chat listener, moderation tools).

## Features

- **Secure Auth**: JWT authentication with email verification and Argon2 hashing
- **Community Forum**: Posts, comments, voting system, and pagination
- **Moderation**: Content reporting system with moderation tools
- **Notifications**: In-app notifications system
- **AI Support**: Gemini-powered AI chat listener with risk detection and conversation titles
- **Therapist Profiles**: Public profiles for verified therapists

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT, Argon2
- **AI**: Google Gemini
- **Email**: Resend
- **Documentation**: Swagger/OpenAPI

## Local Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Inoia-backend
   ```

2. **Configure Environment**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Fill in the required variables in `.env` (especially `GEMINI_API_KEY`, `DATABASE_URL`, etc.).

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Setup Database**
   ```bash
   npx prisma generate
   # Ensure your database is running, then apply migrations if needed
   # npx prisma migrate dev
   ```

5. **Run the Application**
   ```bash
   npm run start:dev
   ```

## Deployment

Currently live on Render at:  
`https://inoia-backend-bmcn.onrender.com/api` (Swagger docs available)

## Status

Actively developed backend for Inoia student mental health platform — core features implemented and production-tested.

## License

MIT
