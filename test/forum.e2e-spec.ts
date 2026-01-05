import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Forum Read-Only (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const cleanDb = async () => {
      await prisma.vote.deleteMany();
      await prisma.comment.deleteMany();
      await prisma.post.deleteMany();
      await prisma.user.deleteMany();
  };

  beforeEach(async () => {
      await cleanDb();
  });

  describe('GET /forum/posts', () => {
    it('should list public non-deleted posts', async () => {
      // Setup
      const author = await prisma.user.create({
        data: {
          email: 'author@test.com',
          username: 'Author',
          role: Role.STUDENT,
        },
      });

      await prisma.post.create({
        data: {
          authorId: author.id,
          title: 'Visible Post',
          content: 'Content',
        },
      });

      await prisma.post.create({
        data: {
          authorId: author.id,
          title: 'Deleted Post',
          content: 'Content',
          deletedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer()).get('/forum/posts').expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Visible Post');
    });

    it('should exclude posts from soft-deleted users', async () => {
        const deletedUser = await prisma.user.create({
            data: {
                email: 'deleted@test.com',
                username: 'DeletedUser',
                role: Role.STUDENT,
                deletedAt: new Date(),
            }
        });

        await prisma.post.create({
            data: {
                authorId: deletedUser.id,
                title: 'Ghost Post',
                content: 'Content',
            }
        });

        const res = await request(app.getHttpServer()).get('/forum/posts').expect(200);
        expect(res.body.data).toHaveLength(0);
    });

    it('Invalid token on public forum route returns 401', async () => {
        await request(app.getHttpServer())
            .get('/forum/posts')
            .set('Authorization', 'Bearer invalid_token')
            .expect(401);
    });
  });

  describe('GET /forum/posts/:id', () => {
    it('Guest receives 404 for deleted post', async () => {
        const author = await prisma.user.create({
            data: { email: 'a@test.com', username: 'A', role: Role.STUDENT }
        });
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'Deleted', content: 'C', deletedAt: new Date() }
        });

        await request(app.getHttpServer()).get(`/forum/posts/${post.id}`).expect(404);
    });

    it('Author can view own deleted post', async () => {
        const passwordHash = await argon2.hash('pass');
        const author = await prisma.user.create({
            data: { email: 'me@test.com', username: 'Me', role: Role.STUDENT, passwordHash }
        });
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'My Deleted', content: 'C', deletedAt: new Date() }
        });

        // Login
        const loginRes = await request(app.getHttpServer())
            .post('/auth/signin')
            .send({ email: 'me@test.com', password: 'pass' });
        const token = loginRes.body.accessToken;

        const res = await request(app.getHttpServer())
            .get(`/forum/posts/${post.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(res.body.title).toBe('My Deleted');
    });
  });

  describe('GET /forum/posts/:id/comments', () => {
      it('Non-author receives 404 for deleted comment', async () => {
        const author = await prisma.user.create({
            data: { email: 'a@test.com', username: 'A', role: Role.STUDENT }
        });
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'P', content: 'C' }
        });
        await prisma.comment.create({
            data: { postId: post.id, authorId: author.id, content: 'Deleted Comment', deletedAt: new Date() }
        });

        const res = await request(app.getHttpServer()).get(`/forum/posts/${post.id}/comments`).expect(200);
        // Should return empty list or filter out the deleted comment
        expect(res.body.data).toHaveLength(0);
      });

      it('Author can view own deleted comment', async () => {
        const passwordHash = await argon2.hash('pass');
        const author = await prisma.user.create({
            data: { email: 'me@test.com', username: 'Me', role: Role.STUDENT, passwordHash }
        });
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'P', content: 'C' }
        });
        await prisma.comment.create({
            data: { postId: post.id, authorId: author.id, content: 'My Deleted Comment', deletedAt: new Date() }
        });

        const loginRes = await request(app.getHttpServer())
            .post('/auth/signin')
            .send({ email: 'me@test.com', password: 'pass' });
        const token = loginRes.body.accessToken;

        const res = await request(app.getHttpServer())
            .get(`/forum/posts/${post.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].content).toBe('My Deleted Comment');
      });
  });
});
