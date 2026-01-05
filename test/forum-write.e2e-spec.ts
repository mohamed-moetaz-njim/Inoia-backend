import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('Forum Write Operations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

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
      await prisma.therapistVerification.deleteMany();
      await prisma.user.deleteMany();
  };

  beforeEach(async () => {
      await cleanDb();
  });

  const createStudent = async (name: string) => {
      const email = `${name}@test.com`;
      const password = 'password';
      const passwordHash = await argon2.hash(password);
      const user = await prisma.user.create({
          data: { email, username: name, role: Role.STUDENT, passwordHash }
      });
      const loginRes = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email, password });
      return { user, token: loginRes.body.accessToken };
  };

  const createTherapist = async (name: string) => {
      const email = `${name}@test.com`;
      const password = 'password';
      const passwordHash = await argon2.hash(password);
      const user = await prisma.user.create({
          data: { 
              email, 
              username: name, 
              role: Role.THERAPIST, 
              passwordHash,
              therapistVerification: {
                  create: {
                      status: 'APPROVED',
                      certificationReference: 'CERT-123'
                  }
              }
          }
      });
      const loginRes = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email, password });
      return { user, token: loginRes.body.accessToken };
  };

  describe('POST /forum/posts', () => {
      it('Guest cannot create post (401)', async () => {
          await request(app.getHttpServer())
              .post('/forum/posts')
              .send({ title: 'Title', content: 'Content' })
              .expect(401);
      });

      it('Student can create post', async () => {
          const { token } = await createStudent('student1');
          const res = await request(app.getHttpServer())
              .post('/forum/posts')
              .set('Authorization', `Bearer ${token}`)
              .send({ title: 'Student Post', content: 'This is a student post content' })
              .expect(201);
          
          expect(res.body.title).toBe('Student Post');
          expect(res.body.author.username).toBe('student1');
          expect(res.body.author.therapistProfile).toBeUndefined();
      });

      it('Therapist can create post and exposes profile', async () => {
        const { token } = await createTherapist('therapist1');
        const res = await request(app.getHttpServer())
            .post('/forum/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Therapist Post', content: 'This is a therapist post content' })
            .expect(201);
        
        expect(res.body.title).toBe('Therapist Post');
        expect(res.body.author.therapistProfile).toBeDefined();
        expect(res.body.author.therapistProfile.certificationReference).toBe('CERT-123');
      });
  });

  describe('PATCH /forum/posts/:id', () => {
      it('Author can edit post', async () => {
          const { user, token } = await createStudent('author');
          const post = await prisma.post.create({
              data: { authorId: user.id, title: 'Original', content: 'Original Content' }
          });

          const res = await request(app.getHttpServer())
              .patch(`/forum/posts/${post.id}`)
              .set('Authorization', `Bearer ${token}`)
              .send({ content: 'Updated Content' })
              .expect(200);

          expect(res.body.content).toBe('Updated Content');
          // Check updatedAt > createdAt (Edited)
          const updatedPost = await prisma.post.findUnique({ where: { id: post.id } });
          expect(updatedPost.updatedAt.getTime()).toBeGreaterThan(updatedPost.createdAt.getTime());
      });

      it('Non-author cannot edit post (404)', async () => {
        const { user: author } = await createStudent('author');
        const { token: attackerToken } = await createStudent('attacker');
        
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'Original', content: 'Original Content' }
        });

        await request(app.getHttpServer())
            .patch(`/forum/posts/${post.id}`)
            .set('Authorization', `Bearer ${attackerToken}`)
            .send({ content: 'Hacked Content' })
            .expect(404);
      });
  });

  describe('DELETE /forum/posts/:id', () => {
      it('Author can delete post', async () => {
        const { user, token } = await createStudent('author');
        const post = await prisma.post.create({
            data: { authorId: user.id, title: 'To Delete', content: 'Content' }
        });

        await request(app.getHttpServer())
            .delete(`/forum/posts/${post.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const deletedPost = await prisma.post.findUnique({ where: { id: post.id } });
        expect(deletedPost.deletedAt).not.toBeNull();
      });

      it('Deleted post is not retrievable via public list', async () => {
        const { user, token } = await createStudent('author');
        const post = await prisma.post.create({
            data: { authorId: user.id, title: 'To Delete', content: 'Content' }
        });

        // Delete
        await request(app.getHttpServer())
            .delete(`/forum/posts/${post.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        // List
        const listRes = await request(app.getHttpServer()).get('/forum/posts').expect(200);
        expect(listRes.body.data.find(p => p.id === post.id)).toBeUndefined();
      });
  });

  describe('Comments', () => {
      it('User can create comment', async () => {
        const { user: author } = await createStudent('author');
        const { user: commenter, token } = await createStudent('commenter');
        
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'Post', content: 'Content' }
        });

        const res = await request(app.getHttpServer())
            .post(`/forum/posts/${post.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Nice post!' })
            .expect(201);
        
        expect(res.body.content).toBe('Nice post!');
        expect(res.body.author.username).toBe('commenter');
      });

      it('Cannot comment on deleted post', async () => {
        const { user: author } = await createStudent('author');
        const { token } = await createStudent('commenter');
        
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'Deleted', content: 'Content', deletedAt: new Date() }
        });

        await request(app.getHttpServer())
            .post(`/forum/posts/${post.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Comment' })
            .expect(404);
      });
  });
});
